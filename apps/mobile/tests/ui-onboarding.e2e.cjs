// Formal H5 onboarding: fully intercepted synthetic server facts only.
// Never inspect auth storage, cookies, tokens, request body/header or credentials.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const ARTIFACT = path.resolve(process.env.ONBOARDING_H5_ARTIFACT || path.join(ROOT, 'apps/mobile/dist/build/h5'));
const PAGE_ORIGIN = 'http://synthetic.invalid';
const IAM_ORIGIN = 'https://127.0.0.1:18087';
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070';
const BASE = PAGE_ORIGIN;
const IAM_CREDENTIAL_PATHS = new Set(['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/token/refresh', '/api/v1/auth/password-reset/request', '/api/v1/auth/password-reset/confirm']);
function auditOutput() {
  const requested = process.env.UI_AUDIT_OUTPUT;
  if (typeof requested === 'string' && requested.length > 0) {
    if (!path.isAbsolute(requested)) throw new Error('UI_AUDIT_OUTPUT must be an absolute path');
    fs.mkdirSync(requested, { recursive: true });
    return requested;
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-ui-'));
}
const OUT = auditOutput();
const GROUP = process.env.UI_AUDIT_GROUP || 'all';
const DIAGNOSTIC = GROUP === 'restoring-diagnostic' && process.env.ONBOARDING_DEBUG_RESTORING === '1';
const sources = ['apps/mobile/src/pages/onboarding/onboarding.vue', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/domain/onboarding-resume.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'apps/mobile/tests/ui-onboarding.e2e.cjs'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'MB004_FORMAL_H5_SYNTHETIC_UI_ONLY', group: GROUP, transport: 'playwright route.fulfill', origin: BASE, origins: { page: PAGE_ORIGIN, iam: IAM_ORIGIN, gateway: GATEWAY_ORIGIN }, artifact: ARTIFACT, realHttp: 'NOT_RUN', browserPlugin: 'Browser plugin not available; Playwright Chromium', sourceHashes: Object.fromEntries(sources.map(file => [file, hash(file)])), checks: [], matrix: [], pageErrors: [], consoleErrors: [], fixtureRequests: [], externalAborts: [] };
function unobservable(name, reason, preservedFailure) {
  report.checks.push({ name, result: 'UNOBSERVABLE', reason, preservedFailure });
  save();
}
function corsHeaders(request) {
  const requested = typeof request.headerValue === 'function' ? request.headerValue('access-control-request-headers') : undefined;
  return { 'access-control-allow-origin': PAGE_ORIGIN, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': requested || 'authorization,content-type,idempotency-key,if-match', vary: 'origin' };
}
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
function responseShape(value, depth = 0) { if (value === null) return 'null'; if (Array.isArray(value)) return value.length ? `array<${typeof value[0]}>` : 'array'; if (typeof value !== 'object') return typeof value; if (depth >= 3) return 'object'; return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, responseShape(nested, depth + 1)])); }
function diagnostic(event, details = {}) { if (DIAGNOSTIC) { (report.diagnosticNetwork ||= []).push({ at: Date.now(), event, ...details }); save(); } }
let browser;
const releases = new Set();
const titles = { 'zh-CN': { gate: '先确认你的年龄', consent: '开始学习前，先看这几条', goal: '你想先达成什么？', assessment: '设置完成，来做个定级测评' }, 'en-US': { gate: 'Confirm your age first', consent: 'Review these items before learning', goal: 'What do you want to reach first?', assessment: 'Setup is complete. Start placement.' } };
function modeMarker(mode) {
  if (mode === 'gate') return '#mobile-onboarding-year';
  if (mode === 'consent') return '.onboarding-record,.onboarding-blocked,.onboarding-error';
  if (mode === 'assessment') return '.onboarding-summary';
  return '.onboarding-choice';
}
function layoutHeading(mode, locale) { return titles[locale][mode === 'unreadable' ? 'goal' : mode]; }
async function revealExits(page) {
  const exits = page.locator('#mobile-onboarding-exits');
  if (await exits.count() && await exits.isVisible()) return;
  await page.locator('.onboarding-more').click();
  await exits.waitFor({ state: 'visible' });
}
async function assertMoreEscape(page) {
  const more = page.locator('.onboarding-more');
  const settings = page.locator('#mobile-onboarding-account-settings');
  const menuHidden = () => page.locator('#mobile-onboarding-exits').waitFor({ state: 'hidden' });
  const focusIs = id => page.waitForFunction(expected => document.activeElement && document.activeElement.id === expected, id);
  await more.click();
  await settings.waitFor();
  assert.equal(await more.getAttribute('role'), 'button');
  assert.equal(await more.getAttribute('tabindex'), '0');
  assert.equal(await more.getAttribute('aria-expanded'), 'true');
  await focusIs('mobile-onboarding-account-settings');
  await page.keyboard.press('Escape');
  await menuHidden();
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('onboarding-more'));
  await page.keyboard.press('Enter');
  await settings.waitFor();
  assert.equal(await more.getAttribute('aria-expanded'), 'true');
  await focusIs('mobile-onboarding-account-settings');
  await page.keyboard.press('Escape');
  await menuHidden();
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('onboarding-more'));
}
function assertLayout(facts, width, mode) {
  assert.equal(facts.stepCount, 3);
  assert.equal(facts.srClipped, true);
  assert.equal(facts.overflow, false);
  const cap = mode === 'consent' || mode === 'goal' ? 560 : 420;
  if (width >= 360) {
    assert.ok(Math.max(...facts.stepTops) - Math.min(...facts.stepTops) <= 1, `steps share one row: ${facts.stepTops.join(',')}`);
    assert.equal(facts.wordmarkInline, true, 'wordmark stays on one row');
  } else assert.equal(facts.wordmarkInsideBrand, true, 'wrapped wordmark stays inside the brand');
  if (width <= cap) {
    assert.ok(Math.abs(facts.panelLeft) <= 1.5, `panel left ${facts.panelLeft}`);
    assert.ok(Math.abs(facts.panelWidth - width) <= 1.5, `panel width ${facts.panelWidth} vs ${width}`);
  } else {
    assert.ok(facts.bodyWidth <= cap + 0.1);
    assert.ok(Math.abs(facts.contentLeft - (facts.viewportWidth - facts.bodyWidth) / 2) <= 2, `column left ${facts.contentLeft}`);
  }
  if (mode === 'gate') {
    assert.ok(Math.abs(facts.noteGap - 16) <= 1, `note gap ${facts.noteGap}`);
    assert.ok(Math.abs(facts.badgeWidth - 24) <= 1 && Math.abs(facts.badgeHeight - 24) <= 1, `badge ${facts.badgeWidth}x${facts.badgeHeight}`);
    assert.equal(facts.primaryCoversYear, false);
    if (facts.viewportHeight >= 800) {
      assert.ok(facts.panelBottom >= facts.viewportHeight - 2, `panel bottom ${facts.panelBottom} viewport ${facts.viewportHeight}`);
      assert.ok(facts.viewportHeight - facts.primaryBottom <= 48, `primary bottom gap ${facts.viewportHeight - facts.primaryBottom}`);
    }
  }
}
async function assertYearPlaceholder(page, expected) {
  const rendered = await page.evaluate(() => {
    const input = document.querySelector('#mobile-onboarding-year');
    const overlay = input?.closest('uni-input')?.querySelector('.uni-input-placeholder');
    const shown = overlay ? getComputedStyle(overlay) : null;
    return { native: input ? input.getAttribute('placeholder') : undefined, overlay: overlay ? overlay.textContent.trim() : null, overlayVisible: Boolean(overlay && overlay.getClientRects().length && shown.visibility !== 'hidden' && shown.display !== 'none') };
  });
  assert.ok(rendered.native === expected || (rendered.overlayVisible === true && rendered.overlay === expected), `year placeholder ${expected}`);
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.map': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveArtifact(route, url) {
  const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const root = path.resolve(ARTIFACT);
  const direct = path.resolve(root, relative);
  if (direct !== root && !direct.startsWith(root + path.sep)) return route.abort();
  const file = fs.existsSync(direct) && fs.statSync(direct).isFile() ? direct : (!path.extname(relative) && fs.existsSync(path.join(root, 'index.html')) ? path.join(root, 'index.html') : '');
  if (!file) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing artifact' });
  return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
}
const purposes = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'];
const record = (type, purpose, required = true) => ({ type, purpose, required, document: { version: 'recorded-fixture-v1', digest: 'synthetic-document-digest', publishedAt: '2026-10-01T00:00:00Z' }, state: 'GRANTED', provenance: { authority: 'IAM_SERVER_RECORDED_CONSENT', recordedAt: '2026-10-02T00:00:00Z', documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST', policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE' }, policyRef: 'synthetic-policy-reference', policyVersion: 'fixture-policy-v1', decisionRef: 'synthetic-decision-reference' });
async function open(mode = 'gate', width = 390, locale = 'zh-CN', theme = 'light', height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const state = { adult: mode === 'gate' ? 'REQUIRED' : 'PASSED', access: mode === 'gate' ? 'RESTRICTED' : 'ELIGIBLE', accepted: ['goal', 'assessment', 'unreadable'].includes(mode), target: mode === 'assessment' ? { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 } : null, hold: null, release: null, adultResponse: 'PASSED', adultAccess: 'ELIGIBLE', adultStatus: 200, targetStatus: 200, recordStatus: 200, records: mode === 'consent' ? [record('TERMS', purposes[0]), record('PRIVACY', purposes[1]), record('ADULT_LEARNING', purposes[2]), record('PRODUCT_ANALYTICS', 'PRODUCT_ANALYTICS', false)] : [], unreadable: mode === 'unreadable', expectedTarget: null, expectLatestYear: null, latestYearAccepted: null, counts: { adult: 0, targetPut: 0, consentPut: 0, preferencePatch: 0, recordGet: 0 } };
  function principal() {
    const permissions = state.accepted && state.adult === 'PASSED' && state.access === 'ELIGIBLE' ? ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read'] : [];
    return { principal: { subject: 'ui-onboarding-synthetic', permissions, roles: [], adultGate: state.adult }, adultGate: { status: state.adult, learningAccess: state.access }, learningAccess: state.access, permissions, consentState: { accepted: state.accepted, unsatisfiedPurposes: state.accepted ? [] : purposes, requiredPurposes: purposes, version: 'summary-not-a-published-catalog', learningAccess: state.accepted ? 'ELIGIBLE' : 'RESTRICTED' } };
  }
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const method = request.method();
    if (url.origin === PAGE_ORIGIN) {
      if (url.pathname.startsWith('/api/v1/')) {
        report.fixtureRequests.push({ mode, method, origin: url.origin, path: url.pathname, result: 'page-origin-api-rejected' });
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_FOUND' }) });
      }
      return serveArtifact(route, url);
    }
    if (url.origin !== IAM_ORIGIN && url.origin !== GATEWAY_ORIGIN) {
      report.externalAborts.push({ mode, method, origin: url.origin, path: url.pathname });
      diagnostic('external-abort', { method, origin: url.origin, path: url.pathname });
      return route.abort();
    }
    const p = url.pathname;
    const headers = { ...corsHeaders(request), 'content-type': 'application/json' };
    diagnostic('request', { method, origin: url.origin, path: p });
    report.fixtureRequests.push({ mode, method, origin: url.origin, path: p });
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders(request), body: '' }); return; }
    const credentialPost = method === 'POST' && IAM_CREDENTIAL_PATHS.has(p);
    if (url.origin === GATEWAY_ORIGIN && p === '/api/v1/iam/adult-gate') state.counts.adult++;
    if (url.origin === IAM_ORIGIN && p === '/api/v1/auth/token/refresh') state.counts.refresh = (state.counts.refresh || 0) + 1;
    if (url.origin === GATEWAY_ORIGIN && p === '/api/v1/learner/targets' && method === 'GET') state.counts.targetGet = (state.counts.targetGet || 0) + 1;
    if (url.origin === GATEWAY_ORIGIN && p === '/api/v1/learner/targets' && method === 'PUT') state.counts.targetPut++;
    if (url.origin === GATEWAY_ORIGIN && p === '/api/v1/iam/consents' && method === 'PUT') state.counts.consentPut++;
    if (state.hold === p) await new Promise(resolve => { state.release = resolve; releases.add(resolve); diagnostic('fixture-held', { method, path: p }); state.onHeld?.(); state.onHeld = null; });
    let status = 200, data = {};
    if (url.origin === IAM_ORIGIN) {
      if (!credentialPost) { status = 404; data = { code: 'NOT_FOUND' }; }
      else if (p === '/api/v1/auth/token/refresh' && state.refreshFailure) { status = 401; data = { code: 'INVALID_REFRESH_TOKEN' }; }
      else if (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh') data = { accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: { status: state.adult, learningAccess: state.access } };
      else { status = 404; data = { code: 'NOT_FOUND' }; }
    } else if (credentialPost) { status = 404; data = { code: 'NOT_FOUND' }; }
    else if (p === '/api/v1/iam/permissions' || p === '/api/v1/iam/principal/me') data = principal();
    else if (p === '/api/v1/iam/adult-gate') {
      if (method === 'POST' && state.expectLatestYear != null) {
        let accepted = false;
        try {
          const body = JSON.parse(request.postData() || 'null');
          accepted = Boolean(body && body.confirmed === true && Number(body.birthYear) === state.expectLatestYear);
        } catch { accepted = false; }
        state.latestYearAccepted = accepted;
      }
      status = state.adultStatus;
      if (status < 400) { state.adult = state.adultResponse; state.access = state.adultAccess; data = { ...principal(), status: state.adultResponse, learningAccess: state.access }; }
      else data = { code: 'SERVICE_UNAVAILABLE' };
    } else if (p === '/api/v1/iam/consents') {
      if (method === 'PUT') { status = 409; data = { code: 'UNEXPECTED_CONSENT_SIGNING' }; }
      else { state.counts.recordGet++; status = state.recordStatus; data = { items: state.records }; }
    } else if (p === '/api/v1/learner/targets') {
      if (method === 'PUT') { status = state.targetStatus; if (status < 400) state.target = { ...state.expectedTarget, stateVersion: 1 }; }
      else if (state.unreadable) status = 503;
      else if (!state.target) status = 404;
      data = state.target || { code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'NOT_FOUND' };
      if (state.readbackMismatch && method === 'GET' && state.counts.targetPut > 0 && state.target) data = { ...state.target, dailyQuotaMinutes: 15 };
      if (method === 'GET' && state.targetClaimsStale && (!state.counts.refresh || state.targetClaimsStale === 'persistent')) { status = 403; data = { code: 'CONSENT_REQUIRED' }; }
    } else if (p === '/api/v1/learner/preferences') {
      if (method === 'PATCH') state.counts.preferencePatch++;
      data = { uiLocale: locale, contentLocale: 'es-ES', timezone: 'Asia/Shanghai', themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', motionMode: 'REDUCED', stateVersion: 0 };
    } else if (p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (p === '/api/v1/auth/logout') data = { success: true };
    else if (p === '/api/v1/learning/today' || p.includes('/plan')) data = { items: [], planVersion: 0 };
    else { status = 404; data = { code: 'NOT_FOUND' }; }
    const recorded = report.fixtureRequests.at(-1);
    if (recorded && recorded.origin === url.origin && recorded.path === p && recorded.method === method) recorded.result = status === 404 ? 'not-found' : 'fulfilled';
    diagnostic('response', { method, path: p, status, shape: responseShape(data) });
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fonboarding%2Fonboarding`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill('ui-onboarding-synthetic'); await page.locator('#mobile-login-password').fill('SyntheticOnly123'); await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding'));
  await page.waitForFunction(({ heading, marker }) => {
    const root = document.querySelector('.yx-onboarding');
    const title = document.getElementById('mobile-onboarding-title');
    return Boolean(root && root.getAttribute('aria-busy') === 'false' && title && title.textContent === heading && root.querySelector(marker));
  }, { heading: layoutHeading(mode, locale), marker: modeMarker(mode) });
  return { context, page, state, hold: p => { state.hold = p; return new Promise(resolve => { state.onHeld = resolve; }); }, release: () => { state.hold = null; if (state.release) { releases.delete(state.release); state.release(); state.release = null; } } };
}
async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.yx-onboarding'), title = document.getElementById('mobile-onboarding-title');
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const contrast = node => { const a = luminance(getComputedStyle(node).color), b = luminance(getComputedStyle(root).backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const boundaries = [...root.querySelectorAll('.onboarding-input,.onboarding-choice:not(.is-selected),.onboarding-quota:not(.is-selected),.onboarding-check-row .uni-checkbox-input')].map(node => { const css = getComputedStyle(node), edge = luminance(css.borderTopColor), fill = luminance(css.backgroundColor), outside = luminance(getComputedStyle(root).backgroundColor); return { control: node.className, border: css.borderTopColor, againstFill: (Math.max(edge, fill) + .05) / (Math.min(edge, fill) + .05), againstPage: (Math.max(edge, outside) + .05) / (Math.min(edge, outside) + .05) }; });
    const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const steps = [...root.querySelectorAll('.onboarding-progress-item')].map(node => box(node));
    const name = box(root.querySelector('.onboarding-brand-name'));
    const mark = box(root.querySelector('.onboarding-mark'));
    const brand = box(root.querySelector('.onboarding-brand'));
    const panel = box(root.querySelector('.onboarding-panel'));
    const primary = box(root.querySelector('.onboarding-primary'));
    const year = box(document.querySelector('#mobile-onboarding-year'));
    const note = box(root.querySelector('.onboarding-note-card'));
    const tip = box(root.querySelector('.onboarding-tip'));
    const badge = box(root.querySelector('.onboarding-note-badge'));
    const content = box(root.querySelector('.onboarding-content'));
    const sr = root.querySelector('.onboarding-sr');
    const srStyle = sr ? getComputedStyle(sr) : null;
    return { url: location.hash, title: title?.textContent, titleFont: getComputedStyle(title).fontSize, titleWeight: getComputedStyle(title).fontWeight, descriptionFont: getComputedStyle(document.querySelector('.onboarding-description')).fontSize, brandIcon: document.querySelector('.onboarding-brand .app-icon').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth + 1, bodyWidth: content.width, contentLeft: content.left, inputFont: document.querySelector('#mobile-onboarding-year') ? getComputedStyle(document.querySelector('#mobile-onboarding-year')).fontSize : null, idleErrors: root.querySelectorAll('.onboarding-error').length, overlay: document.querySelectorAll('vite-error-overlay').length, rawKeys: /mobile\.onboarding\.|\{(?:count|max)\}/.test(root.textContent), titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.onboarding-description')), boundaries, bodyGap: getComputedStyle(document.querySelector('.onboarding-body')).rowGap, primaryFont: root.querySelector('.onboarding-primary') ? getComputedStyle(root.querySelector('.onboarding-primary')).fontSize : null, targets: [...root.querySelectorAll('uni-button,uni-checkbox,.onboarding-check-row')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; }), stepTops: steps.map(item => item.top), stepCount: steps.length, wordmarkInline: Boolean(name && mark && Math.abs((name.top + name.bottom) / 2 - (mark.top + mark.bottom) / 2) <= 2 && mark.left >= name.right - 1), wordmarkInsideBrand: Boolean(name && mark && brand && mark.right <= brand.right + 1 && mark.left >= brand.left - 1), panelLeft: panel ? panel.left : null, panelWidth: panel ? panel.width : null, panelTop: panel ? panel.top : null, panelBottom: panel ? panel.bottom : null, noteGap: note && tip ? tip.top - note.bottom : null, badgeWidth: badge ? badge.width : null, badgeHeight: badge ? badge.height : null, primaryTop: primary ? primary.top : null, primaryBottom: primary ? primary.bottom : null, yearBottom: year ? year.bottom : null, primaryCoversYear: Boolean(primary && year && primary.top < year.bottom - 1 && primary.bottom > year.top + 1 && primary.left < year.right && primary.right > year.left), srClipped: Boolean(srStyle && srStyle.position === 'absolute' && parseFloat(srStyle.width) <= 1), viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
}
async function smoke() {
  for (const mode of ['gate', 'consent', 'goal', 'assessment']) {
    const current = await open(mode), { page } = current;
    const facts = await snapshot(page); assert.equal(facts.title, titles['zh-CN'][mode]); assert.equal(facts.rawKeys, false); assert.equal(facts.overlay, 0); assert.equal(facts.overflow, false);
    assertLayout(facts, 390, mode);
    await page.screenshot({ path: path.join(OUT, `${mode}-390-smoke.png`), fullPage: true });
    if (mode === 'gate') {
      assert.equal(await page.locator('#mobile-onboarding-year').inputValue(), '');
      await assertYearPlaceholder(page, '例如 1995');
      assert.equal(await page.getByRole('checkbox').getAttribute('aria-checked'), 'false');
      assert.equal(await page.locator('#mobile-onboarding-year').getAttribute('name'), 'birthYear'); assert.equal(facts.inputFont, '16px');
      await page.locator('.onboarding-check-row').click();
      assert.equal(await page.getByRole('checkbox').getAttribute('aria-checked'), 'true', 'Entire checkbox row changes once');
      assert.equal(await page.getByRole('checkbox').count(), 1, 'True checkbox needs accessible role');
      const checkbox = page.getByRole('checkbox'); await checkbox.click(); assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
      await checkbox.focus(); await page.keyboard.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true'); await page.keyboard.press('Enter'); assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
      await assertMoreEscape(page);
    } else if (mode === 'consent') { assert.equal(await page.locator('.onboarding-primary').count(), 0); assert.equal(await page.locator('.onboarding-record').count(), 4); assert.equal(current.state.counts.consentPut, 0); }
    else if (mode === 'goal') { assert.equal(await page.locator('.onboarding-choice').count(), 4); assert.equal(await page.locator('.onboarding-quota').count(), 4); }
    else { assert.equal(await page.locator('.onboarding-choice').count(), 0); assert.equal(await page.locator('.onboarding-summary').count(), 1); }
    report.checks.push({ name: 'smoke-' + mode, facts, result: 'PASS' }); save(); await current.context.close();
  }
}
async function matrix() {
  for (const mode of process.env.UI_MATRIX_MODES ? process.env.UI_MATRIX_MODES.split(',') : ['gate', 'consent', 'goal', 'assessment']) for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const current = await open(mode, width, locale, theme), { page } = current;
    const facts = await snapshot(page); assert.equal(facts.title, titles[locale][mode]); assert.equal(facts.rawKeys, false); assert.equal(facts.overlay, 0); assert.equal(facts.overflow, false);
    assert.equal(facts.titleFont, '24px'); assert.equal(facts.titleWeight, '700'); assert.equal(facts.descriptionFont, '14px'); assert.equal(facts.brandIcon, 40); assert.ok(facts.targets.every(target => target.width >= 44 && target.height >= 44));
    assert.ok(facts.bodyWidth <= (mode === 'consent' || mode === 'goal' ? 560.1 : 420.1)); assert.ok(facts.titleContrast >= 4.5 && facts.descriptionContrast >= 4.5); assert.equal(facts.bodyGap, '16px'); if (facts.primaryFont) assert.equal(facts.primaryFont, '16px');
    assert.ok(facts.boundaries.every(edge => edge.againstFill >= 3 && edge.againstPage >= 3), 'Unselected control boundaries need 3:1 against fill and page');
    assertLayout(facts, width, mode);
    if (mode === 'gate') {
      assert.equal(facts.inputFont, '16px');
      if (width === 390) {
        const checkbox = page.getByRole('checkbox'); await checkbox.focus(); await page.keyboard.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
        facts.checkedMark = await checkboxMark(page); assert.ok(facts.checkedMark.contrast >= 3, 'Checked glyph needs 3:1 against actual fill');
        await page.screenshot({ path: path.join(OUT, `gate-${width}-${locale}-${theme}-checked.png`), fullPage: true });
        await page.keyboard.press('Enter'); assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
      }
    }
    if (theme === 'system') { await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); }
    await page.screenshot({ path: path.join(OUT, `${mode}-${width}-${locale}-${theme}.png`), fullPage: true });
    report.matrix.push({ mode, width, locale, theme, ...facts, result: 'PASS' }); save(); await current.context.close();
  }
}
async function controls() {
  const first = await open(), p = first.page, year = p.locator('#mobile-onboarding-year'), primary = p.locator('.onboarding-primary'), checkbox = p.getByRole('checkbox');
  assert.equal(await primary.isDisabled(), true); await year.focus(); await p.keyboard.press('Enter');
  await p.locator('#mobile-onboarding-year-error').waitFor();
  await p.waitForFunction(() => document.activeElement.id === 'mobile-onboarding-year', null, { timeout: 3000 });
  assert.equal(await year.getAttribute('aria-invalid'), 'true'); assert.equal(first.state.counts.adult, 0);
  await year.fill('1990'); await p.keyboard.press('Enter'); await p.locator('#mobile-onboarding-age-error').waitFor();
  await p.waitForFunction(() => document.activeElement.id === 'mobile-onboarding-age', null, { timeout: 3000 });
  assert.equal(await checkbox.getAttribute('aria-invalid'), 'true'); await p.keyboard.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
  await primary.waitFor({ state: 'visible' }); assert.equal(await primary.isDisabled(), false);
  assert.equal(first.state.counts.adult, 0);
  report.checks.push({ name: 'year-confirm-first-error-and-age-focus', result: 'PASS' }); save();
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await year.click(); await p.keyboard.press(modifier + '+A'); await p.keyboard.type('1991');
  assert.equal(await year.inputValue(), '1991');
  first.state.expectLatestYear = 1991; first.state.adultStatus = 503;
  await primary.click(); await p.locator('.onboarding-error[role=alert]').last().waitFor();
  assert.equal(first.state.latestYearAccepted, true);
  assert.equal(first.state.counts.adult, 1); assert.equal(first.state.counts.consentPut, 0); assert.equal(first.state.counts.targetPut, 0);
  assert.equal(await p.locator('.yx-onboarding').getAttribute('aria-busy'), 'false'); assert.ok(p.url().includes('/pages/onboarding/onboarding'));
  await year.click(); await p.keyboard.press(modifier + '+A'); await p.keyboard.press('Backspace'); await year.blur();
  assert.equal(await year.inputValue(), ''); assert.equal(await primary.isDisabled(), true);
  report.checks.push({ name: 'year-keyboard-latest-boolean-iam-acceptance', latestYearAccepted: true, requests: first.state.counts.adult, clearDisables: true, result: 'PASS' }); save();
  unobservable('year-patched-confirmAdultGate-identity', 'Production Vue strips __vueParentComponent and setupState, so confirmAdultGate cannot be patched. The latest typed year is only the boolean latestYearAccepted from the existing adult-gate fixture. The year is not stored.', 'controls results.json: Cannot read setupState at ui-onboarding.e2e.cjs:284');
  await first.context.close();
  const busy = await open(), b = busy.page;
  await b.locator('#mobile-onboarding-year').fill('1990'); await b.locator('.onboarding-check-row').click();
  busy.hold('/api/v1/iam/adult-gate'); await b.locator('.onboarding-primary').click(); await b.locator('.yx-onboarding[aria-busy=true]').waitFor();
  for (const control of await b.locator('.yx-onboarding uni-button,.yx-onboarding uni-checkbox,.yx-onboarding input').all()) assert.equal(await control.isDisabled(), true);
  await b.locator('.onboarding-check-row').click({ force: true }); assert.equal(await b.getByRole('checkbox').getAttribute('aria-checked'), 'true');
  await b.keyboard.press('Enter'); await b.keyboard.press('Space'); assert.equal(busy.state.counts.adult, 1);
  assert.equal(await b.locator('.onboarding-error').count(), 0, 'First valid busy has no idle error space');
  await b.screenshot({ path: path.join(OUT, 'gate-busy.png'), fullPage: true }); busy.release();
  await b.getByRole('heading', { name: titles['zh-CN'].consent }).waitFor(); assert.equal(busy.state.counts.adult, 1); assert.equal(busy.state.counts.consentPut, 0);
  report.checks.push({ name: 'gate-valid-busy-single-locked-to-blocked-consent', requests: 1, result: 'PASS' }); save(); await busy.context.close();
}
async function flow() {
  for (const test of [{ name: '503', status: 503, verdict: 'PASSED', access: 'ELIGIBLE' }, { name: 'restricted', status: 200, verdict: 'PASSED', access: 'RESTRICTED' }, { name: 'missing-access', status: 200, verdict: 'PASSED', access: undefined }, { name: 'not-evaluated', status: 200, verdict: 'NOT_EVALUATED', access: 'RESTRICTED' }, { name: 'unknown', status: 200, verdict: 'UNKNOWN', access: undefined }, { name: 'rejected', status: 200, verdict: 'REJECTED', access: 'RESTRICTED' }]) {
    const next = await open(), p = next.page; next.state.adultStatus = test.status; next.state.adultResponse = test.verdict; next.state.adultAccess = test.access;
    await p.locator('#mobile-onboarding-year').fill('1990'); await p.locator('.onboarding-check-row').click(); await p.locator('.onboarding-primary').click();
    if (test.name === 'rejected') await p.waitForURL(url => url.hash.startsWith('#/pages/forbidden/forbidden'));
    else { await p.locator('.onboarding-error[role=alert]').waitFor(); assert.ok(p.url().includes('/pages/onboarding/onboarding')); assert.equal(await p.getByRole('heading', { name: titles['zh-CN'].gate }).count(), 1); }
    assert.equal(next.state.counts.adult, 1); assert.equal(next.state.counts.consentPut, 0); assert.equal(next.state.counts.targetPut, 0);
    report.checks.push({ name: 'adult-' + test.name, route: new URL(p.url()).hash.split('?')[0], requests: next.state.counts, result: 'PASS' }); save(); await next.context.close();
  }
  for (const scenario of ['empty-records', 'record-outage', 'missing-digest', 'records-withdrawn', 'records-readable']) {
    const next = await open('consent'), p = next.page;
    if (scenario === 'empty-records') next.state.records = [];
    if (scenario === 'record-outage') next.state.recordStatus = 503;
    if (scenario === 'missing-digest') next.state.records[0].document.digest = '';
    if (scenario === 'records-withdrawn') next.state.records[0].state = 'WITHDRAWN';
    await p.getByRole('button', { name: '重新读取', exact: true }).click(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
    assert.equal(await p.locator('.onboarding-primary').count(), 0); assert.equal(next.state.counts.consentPut, 0);
    assert.equal(await p.getByRole('checkbox').count(), 0); assert.equal(await p.locator('.onboarding-blocked').count(), 1);
    assert.equal(await p.getByText('summary-not-a-published-catalog', { exact: false }).count(), 0);
    if (scenario === 'records-readable' || scenario === 'records-withdrawn') { await p.getByRole('button', { name: '展开来源记录' }).click(); assert.equal(await p.getByText('synthetic-document-digest', { exact: false }).count(), 4); }
    report.checks.push({ name: 'consent-' + scenario, signingRequests: 0, actualReload: true, result: 'PASS' }); save(); await next.context.close();
  }
  const goal = await open('goal', 390, 'en-US', 'dark'), g = goal.page;
  goal.state.expectedTarget = { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 30, targetLevel: 'B2', status: 'ACTIVE' };
  await g.locator('[data-goal-code=WORKPLACE_DAILY]').click(); await g.getByRole('button', { name: /^30 minutes/ }).click();
  goal.hold('/api/v1/learner/targets'); await g.locator('.onboarding-primary').click(); await g.locator('.yx-onboarding[aria-busy=true]').waitFor();
  for (const button of await g.locator('.yx-onboarding uni-button').all()) assert.equal(await button.isDisabled(), true);
  await g.locator('.onboarding-primary').click({ force: true }); await g.keyboard.press('Enter'); goal.release();
  await g.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment'));
  assert.equal(goal.state.counts.targetPut, 1); assert.equal(goal.state.counts.consentPut, 0); assert.equal(goal.state.counts.preferencePatch, 0);
  report.checks.push({ name: 'goal-save-readback-single-without-consent-or-preference-write', requests: goal.state.counts, result: 'PASS' }); save(); await goal.context.close();
  for (const status of [409, 503]) {
    const next = await open('goal'), p = next.page; next.state.targetStatus = status; next.state.expectedTarget = { goalCode: 'ZERO_BASIS', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE' };
    await p.locator('[data-goal-code=FOUNDATION]').click(); await p.locator('.onboarding-primary').click(); await p.locator('.onboarding-error[role=alert]').waitFor();
    assert.ok(p.url().includes('/pages/onboarding/onboarding')); assert.equal(await p.locator('.onboarding-summary').count(), 0); assert.equal(next.state.counts.targetPut, 1); assert.equal(next.state.counts.consentPut, 0);
    report.checks.push({ name: 'target-save-' + status + '-stays-editing', result: 'PASS' }); save(); await next.context.close();
  }
  const editing = await open('assessment'), e = editing.page;
  assert.equal(await e.locator('.onboarding-choice').count(), 0); await e.getByRole('button', { name: '调整目标' }).click();
  await e.getByRole('heading', { name: titles['zh-CN'].goal }).waitFor(); assert.equal(await e.locator('[data-goal-code=FOUNDATION]').getAttribute('aria-pressed'), 'true');
  editing.state.expectedTarget = { goalCode: 'CET_4_6', dailyQuotaMinutes: 45, targetLevel: 'B1', status: 'ACTIVE' };
  await e.locator('[data-goal-code=COLLEGE_CET]').click(); await e.getByRole('button', { name: /^45 分钟/ }).click(); await e.locator('.onboarding-primary').click();
  await e.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment')); assert.equal(editing.state.counts.targetPut, 1); assert.equal(editing.state.counts.preferencePatch, 0); assert.equal(editing.state.counts.consentPut, 0);
  report.checks.push({ name: 'saved-summary-readonly-explicit-adjust-save-dirty', result: 'PASS' }); save(); await editing.context.close();
}
async function recovery() {
  for (const stale of ['transient', 'persistent']) {
    const owner = await open('consent'), p = owner.page;
    owner.state.accepted = true; owner.state.targetClaimsStale = stale;
    await p.getByRole('button', { name: '重新读取', exact: true }).click(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
    assert.equal(owner.state.counts.refresh, 1); assert.equal(owner.state.counts.consentPut, 0); assert.equal(owner.state.counts.targetPut, 0);
    await p.getByRole('heading', { name: titles['zh-CN'][stale === 'transient' ? 'goal' : 'consent'] }).waitFor();
    if (stale === 'persistent') { await p.getByRole('alert').waitFor(); assert.equal(await p.locator('.onboarding-primary').count(), 0); }
    report.checks.push({ name: `old-jwt-target403-${stale}-one-owner-refresh-zero-signing`, counts: owner.state.counts, result: 'PASS' }); save(); await owner.context.close();
  }
  const expired = await open('consent'), e = expired.page;
  expired.state.accepted = true; expired.state.targetClaimsStale = 'transient'; expired.state.refreshFailure = true;
  await e.getByRole('button', { name: '重新读取', exact: true }).click(); await e.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  assert.equal(expired.state.counts.refresh, 1); assert.equal(expired.state.counts.targetPut, 0); assert.equal(expired.state.counts.consentPut, 0);
  report.checks.push({ name: 'renewal401-clears-identity-unlocks-public-route', result: 'PASS' }); save(); await expired.context.close();
  const renewed = await open('consent'), r = renewed.page;
  renewed.state.accepted = true;
  await r.getByRole('button', { name: '重新读取', exact: true }).click(); await r.locator('.yx-onboarding[aria-busy=false]').waitFor();
  await r.getByRole('heading', { name: titles['zh-CN'].goal }).waitFor();
  await r.locator('[data-goal-code=FOUNDATION]').click();
  assert.equal(await r.locator('.onboarding-primary').isDisabled(), false);
  assert.equal(renewed.state.counts.consentPut, 0); assert.equal(renewed.state.counts.targetPut, 0); assert.equal(renewed.state.counts.refresh, 1);
  report.checks.push({ name: 'current-consent-read-recovery-visible-goal-no-second-sign', result: 'PASS' }); save();
  unobservable('isLearningReady-internal', 'setupState.session.isLearningReady is not read. The visible goal step, enabled primary, one refresh, and zero consent or target writes are the observable.', 'recovery results.json: Cannot read setupState at ui-onboarding.e2e.cjs:367');
  await renewed.context.close();
  const staleConsent = await open('goal'), p = staleConsent.page;
  staleConsent.state.accepted = false;
  await p.locator('[data-goal-code=FOUNDATION]').click(); await p.locator('.onboarding-primary').click();
  await p.getByRole('heading', { name: titles['zh-CN'].consent }).waitFor({ timeout: 3000 });
  assert.equal(staleConsent.state.counts.targetPut, 0); assert.equal(staleConsent.state.counts.consentPut, 0);
  report.checks.push({ name: 'current-consent-invalid-moves-to-blocked-review-without-write', result: 'PASS' }); save(); await staleConsent.context.close();
  const mismatch = await open('goal'), m = mismatch.page;
  mismatch.state.expectedTarget = { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 30, targetLevel: 'B2', status: 'ACTIVE' }; mismatch.state.readbackMismatch = true;
  await m.locator('[data-goal-code=WORKPLACE_DAILY]').click(); await m.getByRole('button', { name: /^30 分钟/ }).click(); await m.locator('.onboarding-primary').click();
  await m.locator('.onboarding-error[role=alert]').waitFor({ timeout: 3000 }); assert.ok(m.url().includes('/pages/onboarding/onboarding'));
  assert.equal(await m.locator('[data-goal-code=WORKPLACE_DAILY]').getAttribute('aria-pressed'), 'true'); assert.equal(await m.getByRole('button', { name: /^30 分钟/ }).getAttribute('aria-pressed'), 'true');
  report.checks.push({ name: 'target-readback-mismatch-preserves-visible-draft-no-placement', result: 'PASS' }); save(); await mismatch.context.close();
  const unreadable = await open('unreadable'), u = unreadable.page;
  await u.locator('[data-goal-code=FOUNDATION]').click(); assert.equal(await u.locator('.onboarding-primary').isDisabled(), true);
  await u.locator('.onboarding-primary').click({ force: true }); assert.equal(unreadable.state.counts.targetPut, 0);
  unreadable.state.unreadable = false; await u.getByRole('button', { name: '重新读取', exact: true }).click(); await u.locator('.yx-onboarding[aria-busy=false]').waitFor();
  assert.equal(await u.getByRole('alert').count(), 0); report.checks.push({ name: 'target-unreadable-blocks-write-real-reload-recovers', result: 'PASS' }); save(); await unreadable.context.close();
}
async function textAndPointer() {
  if (GROUP !== 'pointer') for (const mode of ['gate', 'consent', 'goal', 'assessment']) for (const locale of ['zh-CN', 'en-US']) {
    const next = await open(mode, 320, locale, 'light', 460), p = next.page;
    await p.evaluate(() => {
      const sizes = [...document.querySelectorAll('.yx-onboarding,.yx-onboarding *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (size) element.style.setProperty('font-size', size * 2 + 'px', 'important');
      const style = document.createElement('style'); style.textContent = '.yx-onboarding .onboarding-error{font-size:28px!important}'; document.head.append(style);
    });
    await revealExits(p); await p.locator('.onboarding-exits').scrollIntoViewIfNeeded(); const facts = await snapshot(p);
    assert.equal(facts.overflow, false); assert.equal(facts.rawKeys, false); assert.ok(facts.targets.every(target => target.width >= 44 && target.height >= 44));
    if (mode === 'gate') assert.equal(facts.inputFont, '32px');
    await p.screenshot({ path: path.join(OUT, `${mode}-320-${locale}-200-short.png`), fullPage: true });
    report.checks.push({ name: `${mode}-${locale}-200-short`, facts, result: 'PASS' }); save(); await next.context.close();
  }
  if (GROUP !== 'short') {
    unobservable('pointer-feedback-snapshot', 'setupState.pointerFeedback is stripped. Click, drag-off, and touch cancel use the adult request count and the visible page.', 'text results.json: __snapshotActive setupState at ui-onboarding.e2e.cjs:418');
    unobservable('pointer-assign-value-during-gesture', 'Assigning input.value during a pointer gesture is refused. It is not a visible edit.', 'text clear ending assigned input.value before the settings click');
    for (const [ending, heldMs] of [['click', 0], ['click', 160], ['drag', 160], ['cancel', 160]]) {
      const next = await open('gate', 390, 'en-US'), p = next.page; next.state.adultStatus = 503;
      const year = p.locator('#mobile-onboarding-year'), button = p.locator('.onboarding-primary');
      await year.fill('1990'); await p.locator('.onboarding-check-row').click();
      await button.scrollIntoViewIfNeeded();
      const point = await button.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY }; });
      await p.mouse.move(point.x, point.y);
      await p.evaluate(() => {
        window.__pointer = { clicks: 0, hit: false };
        const button = document.querySelector('.onboarding-primary');
        button.addEventListener('click', event => { if (event.isTrusted) window.__pointer.clicks++; });
        document.addEventListener('pointerdown', event => { window.__pointer.hit = !!(event.target && event.target.closest && event.target.closest('.onboarding-primary')); }, { once: true, capture: true });
      });
      let skipped = false;
      if (ending === 'cancel') {
        let cdp;
        try {
          cdp = await next.context.newCDPSession(p);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
        } catch (error) {
          skipped = true;
          unobservable('pointer-touch-cancel', 'CDP touch cancel is unavailable here, so this gesture is not marked PASS.', String(error && error.message || error).slice(0, 180));
        }
        if (!skipped) {
          await p.waitForTimeout(heldMs);
          assert.equal(next.state.counts.adult, 0);
          const during = await button.evaluate(node => node.getBoundingClientRect().top + scrollY);
          assert.ok(Math.abs(during - point.top) <= 1);
          try {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
          } catch (error) {
            skipped = true;
            unobservable('pointer-touch-cancel', 'CDP touch cancel is unavailable here, so this gesture is not marked PASS.', String(error && error.message || error).slice(0, 180));
          }
          if (!skipped) await cdp.detach();
        }
      } else if (!heldMs) await p.mouse.click(point.x, point.y);
      else {
        await p.mouse.down();
        await p.waitForTimeout(heldMs);
        const during = await button.evaluate(node => node.getBoundingClientRect().top + scrollY);
        assert.ok(Math.abs(during - point.top) <= 1);
        assert.equal(next.state.counts.adult, 0);
        if (ending === 'drag') await p.mouse.move(5, 5);
        await p.mouse.up();
      }
      if (!skipped) {
        if (ending === 'click') {
          await p.locator('.onboarding-error[role=alert]').last().waitFor();
          assert.equal(next.state.counts.adult, 1);
          assert.ok(p.url().includes('/pages/onboarding/onboarding'));
          assert.equal(await p.locator('.yx-onboarding').getAttribute('aria-busy'), 'false');
        } else {
          await p.waitForTimeout(300);
          assert.equal(next.state.counts.adult, 0);
          assert.equal(await p.getByRole('heading', { name: titles['en-US'].gate }).count(), 1);
        }
        assert.equal(next.state.counts.consentPut, 0); assert.equal(next.state.counts.targetPut, 0);
        const observed = await p.evaluate(() => window.__pointer);
        if (ending !== 'cancel') { assert.equal(observed.hit, true); assert.equal(observed.clicks, ending === 'drag' ? 0 : 1); }
        report.checks.push({ name: `old-center-${ending}-${heldMs}`, beforeTop: point.top, heldMs, observed, requests: next.state.counts.adult, result: 'PASS' });
      }
      save(); await next.context.close();
    }
  }
}
async function restoring() {
  if (GROUP === 'restoring-diagnostic' && !DIAGNOSTIC) unobservable('restoring-diagnostic-internal', 'The setupState restoring probe runs only when ONBOARDING_DEBUG_RESTORING=1. Production Vue strips it. The visible restoring checks do not read it.', 'restoring-diagnostic');
  for (const failed of [false, true]) {
    const owner = await open('consent'), p = owner.page;
    if (DIAGNOSTIC) await installRestoringDiagnostic(p);
    await revealExits(p); await p.getByRole('button', { name: '账号设置', exact: true }).click(); await p.waitForURL(url => url.hash.startsWith('#/pages/settings/settings'));
    owner.state.accepted = true; owner.state.targetClaimsStale = 'transient'; owner.state.refreshFailure = failed;
    const held = owner.hold('/api/v1/auth/token/refresh');
    await p.evaluate(async () => { const runtime = globalThis.uni; if (runtime && typeof runtime.navigateTo === 'function') await runtime.navigateTo({ url: '/pages/onboarding/onboarding' }); else window.location.hash = '#/pages/onboarding/onboarding'; });
    await p.waitForFunction(() => document.querySelector('.yx-onboarding')?.getAttribute('aria-busy') === 'true');
    await held;
    assert.equal(owner.state.counts.refresh, 1); diagnostic('fixture-release-requested', { refreshFailure: failed }); owner.release();
    if (failed) {
      await p.waitForURL(url => url.hash.startsWith('#/pages/login/login')); await p.locator('.login-submit[aria-disabled=false]').waitFor();
      assert.equal(await p.locator('#mobile-login-identifier').isDisabled(), false); assert.equal(await p.locator('#mobile-login-password').isDisabled(), false);
    } else {
      await p.getByRole('heading', { name: titles['zh-CN'].goal }).waitFor(); await p.locator('.yx-onboarding[aria-busy=false]').waitFor();
      await p.locator('[data-goal-code=FOUNDATION]').click(); assert.equal(await p.locator('.onboarding-primary').isDisabled(), false);
    }
    assert.equal(owner.state.counts.refresh, 1); assert.equal(owner.state.counts.targetPut, 0); assert.equal(owner.state.counts.consentPut, 0);
    report.checks.push({ name: `actual-onShow-restoring-claims-refresh-${failed ? '401-public-unlocked' : 'success-goal-available'}`, counts: owner.state.counts, result: 'PASS' }); save(); await owner.context.close();
  }
}
async function installRestoringDiagnostic(page) {
  await page.evaluate(() => {
    const find = () => { let c = document.querySelector('.yx-onboarding')?.__vueParentComponent; while (c && !('restoring' in c.setupState)) c = c.parent; return c?.setupState; };
    const session = find().session;
    window.__restoringDiagnostic = [];
    let previous = '';
    function record(event) {
      const view = find();
      const facts = { route: location.hash.split('?')[0], status: session.status, isAuthenticated: session.isAuthenticated, identityRevision: session.identityRevision, onboardingPresent: !!view, restoring: view ? view.restoring : null, reading: view ? view.reading : null, busy: view ? view.busy : null, step: view ? view.step : null };
      const key = JSON.stringify(facts);
      if (event !== 'sample' || previous !== key) window.__restoringDiagnostic.push({ at: Date.now(), event, ...facts });
      previous = key;
    }
    session.$subscribe(() => record('session-change'), { flush: 'sync', detached: true });
    window.addEventListener('hashchange', () => record('routechange'));
    const sample = () => { record('sample'); requestAnimationFrame(sample); }; record('installed'); requestAnimationFrame(sample);
  });
}
async function boundary() {
  for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const owner = await open('gate', 390, locale, theme), p = owner.page;
    const facts = await snapshot(p); report.checks.push({ name: `actual-visible-checkbox-${locale}-${theme}`, facts }); save();
    assert.ok(facts.boundaries.every(edge => edge.againstFill >= 3 && edge.againstPage >= 3), 'All visible control edges including checkbox need 3:1');
    await p.getByRole('checkbox').focus(); await p.keyboard.press('Space'); assert.equal(await p.getByRole('checkbox').getAttribute('aria-checked'), 'true');
    report.checks.at(-1).checkedMark = await checkboxMark(p); assert.ok(report.checks.at(-1).checkedMark.contrast >= 3, 'Actual SVG check paint needs 3:1');
    await p.screenshot({ path: path.join(OUT, `checkbox-${locale}-${theme}-checked.png`), fullPage: true });
    await p.keyboard.press('Enter'); assert.equal(await p.getByRole('checkbox').getAttribute('aria-checked'), 'false');
    await p.screenshot({ path: path.join(OUT, `checkbox-${locale}-${theme}.png`), fullPage: true }); report.checks.at(-1).result = 'PASS'; save(); await owner.context.close();
  }
}
async function checkboxMark(page) {
  return page.evaluate(() => {
    const box = document.querySelector('.onboarding-check-row .uni-checkbox-input'), css = getComputedStyle(box);
    const glyph = box.querySelector('svg path') || box.querySelector('svg'); if (!glyph) throw new Error('Checked checkbox SVG is missing');
    const paint = getComputedStyle(glyph), markColor = paint.fill === 'none' ? paint.stroke : paint.fill;
    const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const x=value/255; return x<=.04045?x/12.92:((x+.055)/1.055)**2.4; }).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const mark=lum(markColor), fill=lum(css.backgroundColor); return { measured:'actual-svg-paint',mark:markColor, fill:css.backgroundColor, contrast:(Math.max(mark,fill)+.05)/(Math.min(mark,fill)+.05) };
  });
}
async function race() {
  const hidden = await open(), h = hidden.page;
  await h.locator('#mobile-onboarding-year').fill('1990'); await h.locator('.onboarding-check-row').click(); hidden.hold('/api/v1/iam/adult-gate'); await h.locator('.onboarding-primary').click(); await h.locator('.yx-onboarding[aria-busy=true]').waitFor();
  await h.evaluate(() => { const runtime = globalThis.uni; if (!runtime || typeof runtime.navigateTo !== 'function') throw new Error('uni.navigateTo missing'); Promise.resolve(runtime.navigateTo({ url: '/pages/settings/settings' })).catch(error => { window.__onboardingNavFailure = String(error?.errMsg || 'rejected'); }); });
  await h.waitForURL(url => url.hash.startsWith('#/pages/settings/settings')); hidden.release(); await h.waitForLoadState('networkidle');
  assert.equal(hidden.state.counts.adult, 1); assert.equal(hidden.state.counts.consentPut, 0); assert.equal(hidden.state.counts.targetPut, 0);
  await h.evaluate(() => { const runtime = globalThis.uni; if (!runtime || typeof runtime.navigateTo !== 'function') throw new Error('uni.navigateTo missing'); Promise.resolve(runtime.navigateTo({ url: '/pages/onboarding/onboarding' })).catch(error => { window.__onboardingNavFailure = String(error?.errMsg || 'rejected'); }); });
  await h.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding')); await h.locator('.yx-onboarding[aria-busy=false]').waitFor();
  if (await h.locator('#mobile-onboarding-year').count()) assert.equal(await h.locator('#mobile-onboarding-year').inputValue(), '');
  if (await h.getByRole('checkbox').count()) assert.notEqual(await h.getByRole('checkbox').getAttribute('aria-checked'), 'true');
  assert.equal(hidden.state.counts.adult, 1); assert.equal(hidden.state.counts.consentPut, 0); assert.equal(hidden.state.counts.targetPut, 0);
  report.checks.push({ name: 'held-leave-reopen-clears-visible-form-no-extra-writes', result: 'PASS' }); save();
  unobservable('hidden-draft-setupState', 'birthYear, ageConfirmed, and busy inside setupState are not read. The reopened year field, checkbox, route, and write counts are the observable.', 'race results.json: Cannot read setupState at ui-onboarding.e2e.cjs:501');
  await hidden.context.close();
  const identity = await open(), i = identity.page;
  await i.locator('#mobile-onboarding-year').fill('1990'); await i.locator('.onboarding-check-row').click(); identity.hold('/api/v1/iam/adult-gate'); await i.locator('.onboarding-primary').click(); await i.locator('.yx-onboarding[aria-busy=true]').waitFor();
  assert.equal(await i.locator('.onboarding-more').isDisabled(), true);
  unobservable('identity-revocation-during-held-adult', 'Logout is disabled while the adult gate is busy, and setupState.session.logout is stripped. No internal logout is called.', 'race results.json: Cannot read setupState at ui-onboarding.e2e.cjs:508');
  identity.release(); await i.locator('.yx-onboarding[aria-busy=false]').waitFor();
  await revealExits(i); await i.getByRole('button', { name: '退出登录', exact: true }).click();
  await i.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  assert.equal(await i.locator('#mobile-login-identifier').isDisabled(), false); assert.equal(await i.locator('#mobile-login-password').isDisabled(), false);
  assert.equal(identity.state.counts.adult, 1); assert.equal(identity.state.counts.targetPut, 0); assert.equal(identity.state.counts.consentPut, 0);
  report.checks.push({ name: 'identity-revocation-visible-logout-no-late-writes', result: 'PASS' }); save(); await identity.context.close();
  const navigation = await open('assessment'), n = navigation.page;
  await n.evaluate(async () => { const original = globalThis.uni.navigateTo.bind(globalThis.uni); window.__navigationRejects = 0; globalThis.uni = { ...globalThis.uni, navigateTo: options => { if (options.url.startsWith('/pages/assessment/')) { window.__navigationRejects++; throw new Error('Synthetic navigation failure'); } return original(options); } }; });
  await n.locator('.onboarding-primary').click(); await n.getByText('页面未能打开，请重试。', { exact: true }).waitFor({ timeout: 3000 });
  assert.equal(await n.locator('.yx-onboarding').getAttribute('aria-busy'), 'false'); assert.equal(await n.locator('.onboarding-primary').isDisabled(), false); assert.ok(n.url().includes('/pages/onboarding/onboarding'));
  assert.equal(await n.evaluate(() => window.__navigationRejects), 1);
  report.checks.push({ name: 'placement-navigation-rejection-unlocks-and-reports', result: 'PASS' }); save(); await navigation.context.close();
  const exiting = await open('gate'), x = exiting.page;
  await revealExits(x); await x.getByRole('button', { name: '退出登录', exact: true }).click(); await x.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  report.checks.push({ name: 'normal-exit-identity-change-public-route', result: 'PASS' }); save(); await exiting.context.close();
}
async function layout() {
  for (const mode of ['gate', 'consent', 'goal', 'assessment']) for (const width of [320, 390, 768]) {
    const current = await open(mode, width), { page } = current;
    const facts = await snapshot(page);
    assert.equal(facts.title, titles['zh-CN'][mode]); assert.equal(facts.rawKeys, false); assert.equal(facts.overlay, 0);
    assertLayout(facts, width, mode);
    if (mode === 'gate') {
      assert.equal(await page.locator('#mobile-onboarding-year').inputValue(), '');
      assert.equal(await page.getByRole('checkbox').getAttribute('aria-checked'), 'false');
      if (width === 390) {
        await assertMoreEscape(page);
      }
    }
    if (mode === 'goal' && width === 390) {
      await page.locator('[data-goal-code=FOUNDATION]').click();
      assert.equal(await page.locator('[data-goal-code=FOUNDATION]').getAttribute('aria-pressed'), 'true');
      await page.getByText('这个选择还只在本页，保存后才会写入服务端。', { exact: true }).waitFor();
      assert.equal(current.state.counts.targetPut, 0);
    }
    await page.screenshot({ path: path.join(OUT, `${mode}-${width}-layout.png`), fullPage: true });
    report.checks.push({ name: `layout-${mode}-${width}`, facts, result: 'PASS' }); save(); await current.context.close();
  }
  const english = await open('gate', 390, 'en-US'), { page } = english;
  const facts = await snapshot(page);
  assert.equal(facts.title, titles['en-US'].gate);
  assertLayout(facts, 390, 'gate');
  await assertYearPlaceholder(page, 'e.g. 1995');
  await page.screenshot({ path: path.join(OUT, 'gate-390-en-layout.png'), fullPage: true });
  report.checks.push({ name: 'layout-gate-390-en', facts, result: 'PASS' }); save(); await english.context.close();
}
(async () => {
  browser = await chromium.launch();
  if (GROUP === 'layout') await layout();
  if (['smoke', 'all'].includes(GROUP)) await smoke();
  if (['matrix', 'all'].includes(GROUP)) await matrix();
  if (['controls', 'all'].includes(GROUP)) await controls();
  if (['flow', 'all'].includes(GROUP)) await flow();
  if (['recovery', 'all'].includes(GROUP)) await recovery();
  if (['race', 'all'].includes(GROUP)) await race();
  if (['restoring', 'restoring-diagnostic', 'all'].includes(GROUP)) await restoring();
  if (['boundary', 'all'].includes(GROUP)) await boundary();
  if (['text', 'short', 'pointer', 'all'].includes(GROUP)) await textAndPointer();
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /Failed to load resource:.*status of (404|409|503|401|403)\b/.test(message)));
  report.unobservable = report.checks.filter(item => item.result === 'UNOBSERVABLE').map(item => item.name);
  report.status = 'PASS_GROUP_UI_SYNTHETIC_NOT_BUSINESS_ACCEPTANCE'; report.sourceHashesAfter = Object.fromEntries(sources.map(file => [file, hash(file)])); save();
  console.log(JSON.stringify({ status: report.status, group: GROUP, matrix: report.matrix.length, checks: report.checks.length, unobservable: report.unobservable, pageErrors: report.pageErrors.length, output: OUT }));
})().catch(async error => {
  report.status = 'FAIL'; report.failure = error.stack; save();
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) {
    if (DIAGNOSTIC) { try { report.diagnosticBrowser = await page.evaluate(() => window.__restoringDiagnostic); save(); } catch {} }
    try { report.failureState = await page.evaluate(() => ({ route: location.hash.split('?')[0], focusId: document.activeElement.id, busy: document.querySelector('.yx-onboarding')?.getAttribute('aria-busy'), errorPresent: document.querySelectorAll('.onboarding-error[role=alert]').length })); await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true }); }
    catch (captureError) { report.captureFailure = captureError.message; }
  }
  save(); console.error(error.stack); process.exitCode = 1;
}).finally(async () => { for (const release of releases) release(); await browser?.close(); });
