/*
 * Browser regression for the V1 public site. Start the official site separately
 * on its configured port, then run:
 *   node apps/official-site/tests/browser/official-v1-regression.cjs
 *
 * Projection responses and clipboard operations below are explicit fixtures;
 * they verify rendered UI behavior, not Gateway/IAM or business acceptance.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.OFFICIAL_SITE_URL || 'http://127.0.0.1:18182';
const results = [];

function projection(state) {
  const status = { state, updatedAt: null, errorCode: null, stale: false };
  return {
    projection: {
      schemaVersion: 'public-site-v1', uiLocale: 'zh-CN', contentLocale: 'en-US', generatedAt: null,
      courses: [], pricingPlans: [], skus: [], campaigns: [], downloadChannels: [], announcements: [], complianceNotices: [],
    },
    state, stale: state === 'recovery', source: 'memory-cache', errorCode: null,
    facets: Object.fromEntries(['courses', 'pricing', 'download', 'announcements', 'compliance'].map(key => [key, { ...status }])),
    commerceState: state, commerceErrorCode: null,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  async function check(name, width, run, init) {
    const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await run(page, context);
      assert.deepEqual(errors, [], 'unexpected browser errors');
      results.push({ name, width, pass: true });
      console.log(`PASS ${name} (${width})`);
    } catch (error) {
      results.push({ name, width, pass: false, message: error.message });
      console.error(`FAIL ${name} (${width}): ${error.message}`);
    } finally {
      await context.close();
    }
  }
  async function checkCatalogRetry(page, routeName, moveFocus) {
    const facetName = routeName === 'pricing' ? 'pricing' : 'download';
    const failed = projection('ready');
    failed.facets[facetName] = { state: 'error', updatedAt: null, errorCode: 'UI_TEST_ERROR', stale: false };
    const empty = projection('empty');
    let requestCount = 0;
    let releaseResponse;
    let notifyRequested;
    const pendingResponse = new Promise(resolve => { releaseResponse = resolve; });
    const retryRequested = new Promise(resolve => { notifyRequested = resolve; });
    await page.route('**/api/public-projection**', async request => {
      requestCount++;
      if (requestCount === 1) {
        return request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(failed) });
      }
      notifyRequested();
      await pendingResponse;
      return request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(empty) });
    });
    try {
      await page.goto(`${origin}/${routeName}`, { waitUntil: 'networkidle' });
      const panel = page.locator('.v1-catalog-panel');
      const retry = panel.locator('.v1-catalog-status[data-state="error"] button');
      await retry.waitFor({ state: 'visible' });
      await retry.focus();
      await page.keyboard.press('Enter');
      let timeout;
      try {
        await Promise.race([retryRequested, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Enter did not start the retry request')), 5000);
        })]);
      } finally {
        clearTimeout(timeout);
      }
      assert.ok(requestCount >= 2, 'retry must issue a new request');
      assert.equal(await panel.getAttribute('tabindex'), '-1');
      assert.ok(await panel.getAttribute('aria-label'), 'focused panel needs an accessible name');
      assert.equal(await panel.evaluate(element => element === document.activeElement), true);
      const focusStyle = await panel.evaluate(element => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
      assert.ok(focusStyle.outline !== 'none' || focusStyle.shadow !== 'none', 'keyboard focus must be visible');

      let movedTarget;
      if (moveFocus) {
        await page.keyboard.press('Shift+Tab');
        movedTarget = await page.evaluateHandle(() => document.activeElement);
        assert.equal(await movedTarget.evaluate(element => element !== document.body), true);
        assert.equal(await panel.evaluate(element => element === document.activeElement), false);
      }
      releaseResponse();
      await panel.locator('.v1-catalog-status[data-state="empty"]').waitFor({ state: 'visible' });
      assert.equal(await panel.locator('[aria-live]').count(), 1, 'there should be one status live region');
      if (moveFocus) {
        assert.equal(await movedTarget.evaluate(element => element === document.activeElement), true, 'response must not steal focus after the user moves it');
      } else {
        assert.equal(await panel.evaluate(element => element === document.activeElement), true, 'replacing retry must retain panel focus');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('header')), false, 'Tab must continue from the panel');
      }
    } finally {
      releaseResponse();
    }
  }
  try {
    for (const width of [390, 1440]) {
      await check('FAQ opens, filters, searches and returns focus after reset', width, async page => {
        await page.goto(`${origin}/help`, { waitUntil: 'networkidle' });
        const questions = page.locator('.v1-info-help__faq');
        const categories = page.locator('.v1-info-help__categories button');
        const search = page.getByRole('searchbox');
        assert.equal(await questions.count(), 8);
        for (let index = 0; index < 8; index++) {
          const question = questions.nth(index);
          const button = question.getByRole('button');
          if (index === 0) { await button.focus(); await page.keyboard.press('Enter'); }
          else await button.click();
          assert.equal(await button.getAttribute('aria-expanded'), 'true');
          assert.ok((await question.locator('.v1-info-help__answer').innerText()).trim());
          await button.click();
          assert.equal(await button.getAttribute('aria-expanded'), 'false');
        }
        await categories.nth(3).click();
        assert.equal(await categories.nth(3).getAttribute('aria-pressed'), 'true');
        assert.ok((await questions.count()) > 0 && (await questions.count()) < 8);
        const query = (await questions.first().getByRole('button').innerText()).trim().slice(0, 3);
        await search.fill(query);
        assert.ok((await questions.count()) > 0);
        await search.fill('UI_NO_RESULT_928');
        assert.equal(await questions.count(), 0);
        await page.locator('.v1-info-help__empty button').click();
        assert.equal(await questions.count(), 8);
        assert.equal(await search.evaluate(element => element === document.activeElement), true);
      });
      await check('trial dialog feedback, reset and focus return', width, async page => {
        await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
        const opener = page.locator('.hero-secondary');
        await opener.click();
        const dialog = page.locator('dialog.trial-dialog[open]');
        await dialog.waitFor({ state: 'visible' });
        for (const [answer, expected] of [['read', /再想一想/], ['to read', /换一种说法/], ['reading', /答对了/]]) {
          await dialog.getByRole('button', { name: answer, exact: true }).click();
          assert.match(await dialog.getByRole('status').innerText(), expected);
        }
        await dialog.getByRole('button', { name: '再做一次' }).click();
        assert.equal(await dialog.getByRole('button', { name: 'read', exact: true }).evaluate(element => element === document.activeElement), true);
        await dialog.getByRole('button', { name: 'reading', exact: true }).click();
        await dialog.getByRole('button', { name: '完成体验' }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await opener.evaluate(element => element === document.activeElement), true);
        await opener.click();
        await dialog.waitFor({ state: 'visible' });
        assert.equal(await dialog.getByRole('button', { name: 'read', exact: true }).getAttribute('aria-pressed'), 'false');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await opener.evaluate(element => element === document.activeElement), true);
      });
    }
    await check('independent pricing error is not hidden by aggregate recovery', 390, async page => {
      const data = projection('recovery');
      data.facets.pricing = { state: 'error', updatedAt: null, errorCode: 'PUBLIC_COMMERCE_DEGRADED', stale: false };
      data.commerceState = 'error';
      data.commerceErrorCode = 'PUBLIC_COMMERCE_DEGRADED';
      data.projection.skus.push({ id: 'old', skuId: 'old', name: 'UI测试过期价格', price: '¥1', unit: '', currency: 'CNY', description: '', entitlements: [], availability: 'available' });
      await page.route('**/api/public-projection**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
      await page.goto(`${origin}/pricing`, { waitUntil: 'networkidle' });
      const main = page.locator('main');
      await main.getByText('公开内容暂时无法加载', { exact: false }).waitFor({ state: 'visible' });
      assert.equal(await main.getByText('UI测试过期价格').count(), 0);
    });
    for (const success of [true, false]) {
      await check(`device copy ${success ? 'success' : 'denied'} and focus return`, 390, async page => {
        await page.goto(`${origin}/start`, { waitUntil: 'networkidle' });
        const opener = page.locator('.v1-start-switch');
        await opener.click();
        const dialog = page.locator('dialog[open]');
        await dialog.locator('button').filter({ hasText: /复制/ }).click();
        assert.match(await dialog.getByRole('status').innerText(), success ? /已复制|复制成功/ : /未能复制|复制失败/);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await opener.evaluate(element => element === document.activeElement), true);
      }, success
        ? () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }); }
        : () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }); });
    }
    for (const routeName of ['pricing', 'download']) {
      for (const width of [390, 1440]) {
        for (const moveFocus of [false, true]) {
          await check(`${routeName} keyboard retry ${moveFocus ? 'respects moved focus' : 'retains panel focus'}`, width,
            page => checkCatalogRetry(page, routeName, moveFocus));
        }
      }
    }
  } finally {
    await browser.close();
  }
  process.exitCode = results.some(result => !result.pass) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
