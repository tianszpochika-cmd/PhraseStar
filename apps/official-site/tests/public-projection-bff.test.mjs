import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { computed, ref, watch } from "vue";

const siteRoot = join(import.meta.dirname, "..");
const read = (path) => readFile(join(siteRoot, path), "utf8");
const [routeSource, gatewaySource, projectionSource, composableSource] = await Promise.all([
  read("server/api/public-projection.get.ts"),
  read("utils/gateway.ts"),
  read("utils/public-projection.ts"),
  read("composables/usePublicProjection.ts"),
]);

function loadTypeScript(source, globals = {}) {
  const defaultUiLocale = ref("zh-CN");
  let nextInstanceId = 0;
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    URL,
    AbortSignal,
    computed,
    watch,
    onBeforeUnmount: () => {},
    useSiteText: () => ({ locale: defaultUiLocale }),
    useId: () => `test-${++nextInstanceId}`,
    ...globals,
  });
  return module.exports;
}

const gateway = loadTypeScript(gatewaySource);
const projection = loadTypeScript(projectionSource);
const readyPayload = {
  data: {
    uiLocale: "zh-CN",
    courses: [{ id: "course-1", title: "基础英语" }],
  },
};
const emptyPayload = { data: { uiLocale: "zh-CN", courses: [] } };
// Shape of the public B9 data + meta envelope, including the mandatory lists.
const canonicalContentPayload = () => ({
  data: {
    projectionVersion: 1, contentEpoch: 1, generatedAt: "2026-11-03T00:00:00Z",
    courses: [{ contentCode: "course-1", contentType: "COURSE", title: "基础英语", contentLocale: "en-US", targetLevel: "A1", contentVersionId: 1, availability: "PUBLISHED" }],
    pricing: [],
    downloads: [{ platform: "WEB", channel: "web", status: "AVAILABLE", downloadUrl: "https://study.example.com/" }],
    announcements: [{ announcementCode: "news-1", title: "公告", summary: "公开消息", publishedAt: "2026-11-03T00:00:00Z" }],
    compliance: [{ noticeCode: "notice-1", title: "公示", body: "公开说明", version: "1", effectiveAt: "2026-11-03T00:00:00Z" }],
  },
  meta: { projectionVersion: 1, contentEpoch: 1, generatedAt: "2026-11-03T00:00:00Z", source: "CONTENT_SERVICE", stale: false },
});
const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(internalBase = "http://api-gateway:18070/api/v1") {
  const calls = [];
  let now = 1_000;
  const config = {
    gatewayInternalBaseUrl: internalBase,
    public: {
      gatewayBaseUrl: "https://public.example.invalid/api/v1",
      publicProjectionPath: "/public/site/projection",
    },
  };
  let fetchImpl = async (url) =>
    ok(url.includes("/public/commerce/catalog") ? { plans: [] } : readyPayload);
  const route = loadTypeScript(routeSource, {
    require: (name) => {
      if (name === "~/utils/gateway") return gateway;
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    defineEventHandler: (handler) => handler,
    useRuntimeConfig: () => config,
    getQuery: (event) => event.query,
    setResponseHeader: (event, name, value) => {
      event.headers[name] = value;
    },
    Date: { now: () => now },
    fetch: (...args) => {
      calls.push(args[0]);
      return fetchImpl(...args);
    },
  }).default;
  return {
    calls,
    config,
    advance: (milliseconds) => { now += milliseconds; },
    setFetch: (next) => { fetchImpl = next; },
    async request(locale = "zh-CN") {
      const event = { query: { locale }, headers: {} };
      const body = await route(event);
      return { body, headers: event.headers };
    },
  };
}

test("BFF uses the private Gateway for both public reads and caches a complete response", async () => {
  const app = harness();
  const { body, headers } = await app.request();
  assert.equal(body.state, "ready");
  assert.equal(body.source, "gateway");
  assert.equal(headers["cache-control"], "public, max-age=60, s-maxage=60");
  assert.equal(headers["x-public-projection-commerce"], "gateway");
  assert.deepEqual(app.calls, [
    "http://api-gateway:18070/api/v1/public/site/projection?uiLocale=zh-CN",
    "http://api-gateway:18070/api/v1/public/commerce/catalog?uiLocale=zh-CN",
  ]);
});

test("an upstream failure uses a no-store fallback, including a recent recovery snapshot", async () => {
  const app = harness();
  app.setFetch(async () => { throw new Error("TLS failure"); });
  const first = await app.request();
  assert.equal(first.body.state, "error");
  assert.equal(first.body.source, "empty-fallback");
  assert.equal(first.headers["cache-control"], "no-store");

  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : readyPayload));
  assert.equal((await app.request()).body.state, "ready");
  app.setFetch(async () => { throw new Error("temporary outage"); });
  const recovery = await app.request();
  assert.equal(recovery.body.state, "recovery");
  assert.equal(recovery.body.source, "memory-cache");
  assert.equal(recovery.headers["cache-control"], "no-store");
});

test("an authoritative empty projection clears the old ready snapshot", async () => {
  const app = harness();
  await app.request();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : emptyPayload));
  const empty = await app.request();
  assert.equal(empty.body.state, "empty");
  assert.match(empty.headers["cache-control"], /^public/);
  app.setFetch(async () => { throw new Error("outage"); });
  const after = await app.request();
  assert.equal(after.body.state, "error");
  assert.equal(after.headers["cache-control"], "no-store");
});

test("an expired snapshot cannot revive an old course during an outage", async () => {
  const app = harness();
  await app.request();
  app.advance(60_001);
  app.setFetch(async () => { throw new Error("outage"); });
  const after = await app.request();
  assert.equal(after.body.state, "error");
  assert.equal(after.body.projection.courses.length, 0);
  assert.equal(after.headers["cache-control"], "no-store");
});

test("upstream rejection cannot expose a cached public projection", async () => {
  for (const status of [401, 403, 404, 410]) {
    const app = harness();
    await app.request();
    app.setFetch(async () => ({ ok: false, status, json: async () => ({}) }));
    const denied = await app.request();
    assert.equal(denied.body.state, status === 401 || status === 403 ? "permission" : "error");
    assert.equal(denied.body.projection.courses.length, 0);
    assert.equal(denied.headers["cache-control"], "no-store");
    app.setFetch(async () => { throw new Error("outage"); });
    assert.equal((await app.request()).body.state, "error");
  }
});

test("an in-flight older ready response cannot refill a revoked public snapshot", async () => {
  for (const status of [401, 403, 404, 410]) {
    const app = harness();
    const commerceStarted = deferred();
    const delayedCommerce = deferred();
    let contentReads = 0;
    app.setFetch(async (url) => {
      if (url.includes("/public/commerce/catalog")) {
        commerceStarted.resolve();
        return delayedCommerce.promise;
      }
      contentReads += 1;
      return contentReads === 1 ? ok(readyPayload) : { ok: false, status, json: async () => ({}) };
    });
    const oldReady = app.request();
    await commerceStarted.promise;
    const revoked = await app.request();
    assert.equal(revoked.body.projection.courses.length, 0);
    delayedCommerce.resolve(ok({ plans: [] }));
    const late = await oldReady;
    assert.equal(late.body.projection.courses.length, 0);
    assert.equal(late.headers["cache-control"], "no-store");
    app.setFetch(async () => { throw new Error("later outage"); });
    const after = await app.request();
    assert.equal(after.body.projection.courses.length, 0);
    assert.equal(after.body.state, "error");
  }
});

test("browser network failure clears prior public facts and exposes only a controlled code", async () => {
  const state = new Map();
  const readyFacets = {
    courses: { state: "ready", updatedAt: null, errorCode: null, stale: false },
    pricing: { state: "ready", updatedAt: null, errorCode: null, stale: false },
    download: { state: "ready", updatedAt: null, errorCode: null, stale: false },
    announcements: { state: "ready", updatedAt: null, errorCode: null, stale: false },
    compliance: { state: "ready", updatedAt: null, errorCode: null, stale: false },
  };
  const errorFacets = {
    courses: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
    pricing: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
    download: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
    announcements: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
    compliance: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
  };
  let request = async () => ({
    projection: projection.normalizePublicProjection(readyPayload),
    state: "ready", stale: false, source: "gateway", errorCode: null,
    facets: readyFacets, commerceState: "ready", commerceErrorCode: null,
  });
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => (...args) => request(...args),
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    useRoute: () => ({ query: { locale: "zh-CN" } }),
  });
  const page = composable.usePublicProjection("fail-closed");
  await page.load();
  assert.equal(page.projection.value.projection.courses.length, 1);
  assert.equal(page.projection.value.facets.courses.state, "ready");
  request = async () => { throw new Error("private upstream network detail"); };
  await page.load();
  assert.equal(page.projection.value.state, "error");
  assert.equal(page.projection.value.projection.courses.length, 0);
  assert.equal(page.projection.value.projection.pricingPlans.length, 0);
  assert.equal(page.projection.value.facets.pricing.state, "error");
  assert.equal(page.projection.value.facets.pricing.errorCode, "PUBLIC_PROJECTION_UNAVAILABLE");
  assert.equal(page.projection.value.commerceState, "error");
  assert.equal(page.projection.value.errorCode, "PUBLIC_PROJECTION_UNAVAILABLE");
});

test("composable initial and thrown-network shapes carry complete facet state", async () => {
  const fresh = new Map();
  const probe = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => async () => { throw new Error("probe network down"); },
        useState: (key, initialize) => {
          if (!fresh.has(key)) fresh.set(key, { value: initialize() });
          return fresh.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    useRoute: () => ({ query: { locale: "zh-CN" } }),
  });
  const probePage = probe.usePublicProjection("shape-probe");
  assert.equal(probePage.projection.value.state, "loading");
  assert.equal(probePage.projection.value.facets.courses.state, "loading");
  assert.equal(probePage.projection.value.commerceState, "loading");
  await probePage.load();
  assert.equal(probePage.projection.value.state, "error");
  assert.equal(probePage.projection.value.facets.download.state, "error");
  assert.equal(probePage.projection.value.commerceErrorCode, "PUBLIC_PROJECTION_UNAVAILABLE");
  assert.equal(probePage.projection.value.projection.courses.length, 0);
});

test("commerce degradation clears pricing while preserving unrelated content", async () => {
  const state = new Map();
  let degraded = false;
  const response = projection.normalizePublicProjectionResponse(readyPayload);
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => async (_url, options) => {
          options.onResponse({ response: { headers: { get: () => degraded ? "degraded" : "gateway" } } });
          return response;
        },
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    useRoute: () => ({ query: { locale: "zh-CN" } }),
  });
  const pricing = composable.usePublicProjection("pricing");
  const home = composable.usePublicProjection("home");
  await pricing.load();
  degraded = true;
  await pricing.load();
  await home.load();
  assert.equal(pricing.loadState.value.state, "error");
  assert.equal(pricing.loadState.value.facets.pricing.state, "error");
  assert.equal(pricing.loadState.value.commerceErrorCode, "PUBLIC_COMMERCE_PROJECTION_UNAVAILABLE");
  assert.equal(pricing.loadState.value.projection.pricingPlans.length, 0);
  assert.equal(home.loadState.value.state, "ready");
  assert.equal(home.loadState.value.projection.courses.length, 1);
});

test("malformed facet state fails closed and unreadable global state clears old facts", async () => {
  const state = new Map();
  const ready = projection.normalizePublicProjectionResponse(readyPayload);
  const withOldFacts = {
    ...ready,
    projection: {
      ...ready.projection,
      pricingPlans: [{ id: "old-price", entitlements: [] }],
      complianceNotices: [{ id: "old-notice" }],
    },
  };
  let response = withOldFacts;
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => async () => response,
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const page = composable.usePublicProjection("facet-validation");
  for (response of [
    { ...withOldFacts, facets: undefined },
    { ...withOldFacts, facets: { ...ready.facets, pricing: { ...ready.facets.pricing, state: "invalid" } } },
    { ...withOldFacts, facets: { ...ready.facets, compliance: { ...ready.facets.compliance, stale: "false" } } },
    { ...withOldFacts, facets: { ...ready.facets, pricing: { ...ready.facets.pricing, state: "ready", stale: true } } },
    { ...withOldFacts, state: "ready", stale: true },
    { ...withOldFacts, projection: {} },
    { ...withOldFacts, projection: { ...withOldFacts.projection, pricingPlans: [{ id: "old-price" }] } },
    { ...withOldFacts, projection: { ...withOldFacts.projection, pricingPlans: [{ id: "old-price", entitlements: [null] }] } },
  ]) {
    await page.load();
    assert.equal(page.loadState.value.state, "error");
    assert.equal(page.getFacet("pricing").state, "error");
    assert.equal(page.loadState.value.projection.pricingPlans.length, 0);
    assert.equal(page.loadState.value.projection.complianceNotices.length, 0);
  }
  for (const state of ["permission", "error", "maintenance"]) {
    response = { ...withOldFacts, state };
    await page.load();
    assert.equal(page.loadState.value.state, state);
    assert.equal(page.getFacet("compliance").state, state);
    assert.equal(page.loadState.value.projection.complianceNotices.length, 0);
  }
  response = { ...withOldFacts, state: "recovery", facets: { ...ready.facets, pricing: { ...ready.facets.pricing, state: "ready" } } };
  await page.load();
  assert.equal(page.getFacet("pricing").state, "ready");
  assert.equal(page.loadState.value.projection.pricingPlans.length, 1);
});

test("public projection follows UI locale and ignores older in-flight responses", async () => {
  const uiLocale = ref("en-US");
  const requests = [];
  const state = new Map();
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => (_url, options) => {
          const item = { locale: options.query.locale, ...deferred() };
          requests.push(item);
          return item.promise;
        },
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    useSiteText: () => ({ locale: uiLocale }),
  });
  const page = composable.usePublicProjection("locale");
  const oldEnglish = page.load();
  assert.equal(requests[0].locale, "en-US");
  uiLocale.value = "zh-CN";
  assert.equal(requests[1].locale, "zh-CN");
  uiLocale.value = "en-US";
  assert.equal(requests[2].locale, "en-US");
  assert.equal(page.loadState.value.state, "loading");
  const responseFor = (locale, title) => projection.normalizePublicProjectionResponse({
    data: { uiLocale: locale, courses: [{ id: title, title }] },
  }, locale);
  requests[2].resolve(responseFor("en-US", "latest"));
  await page.load();
  requests[1].resolve(responseFor("zh-CN", "old-chinese"));
  requests[0].resolve(responseFor("en-US", "old-english"));
  await oldEnglish;
  assert.equal(page.loadState.value.projection.courses[0].title, "latest");
  assert.equal(page.loadState.value.projection.uiLocale, "en-US");
  uiLocale.value = "zh-CN";
  const revisited = composable.usePublicProjection("locale");
  assert.equal(revisited.loadState.value.state, "loading");
  assert.equal(revisited.loadState.value.projection.courses.length, 0);
});

test("leaving a public page clears its instance state before a later visit", async () => {
  const state = new Map();
  const disposers = [];
  const ready = projection.normalizePublicProjectionResponse(readyPayload);
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => async () => ready,
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    onBeforeUnmount: (callback) => disposers.push(callback),
    clearNuxtState: (key) => { if (state.has(key)) state.get(key).value = undefined; },
  });
  for (let visit = 0; visit < 3; visit += 1) {
    const page = composable.usePublicProjection("repeat");
    assert.equal(page.loadState.value.state, "loading");
    await page.load();
    assert.equal([...state.values()].filter((entry) => entry.value !== undefined).length, 1);
    disposers.pop()();
    assert.equal([...state.values()].filter((entry) => entry.value !== undefined).length, 0);
  }
});

test("a stale-only content signal becomes recovery without aging fresh commerce", async () => {
  const plan = {
    skuId: "fresh-sku", title: "公开方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "fresh-sku-v1",
  };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [plan] } : { ...readyPayload, stale: true }));
  const { body, headers } = await app.request();
  assert.equal(body.state, "recovery");
  assert.equal(body.stale, true);
  assert.equal(body.facets.courses.state, "recovery");
  assert.equal(body.facets.courses.stale, true);
  assert.equal(body.facets.pricing.state, "ready");
  assert.equal(body.facets.pricing.stale, false);
  assert.equal(body.projection.pricingPlans.length, 1);
  assert.equal(headers["cache-control"], "no-store");
  for (const state of ["permission", "error", "maintenance"]) {
    const normalized = projection.normalizePublicProjectionResponse({ state: "recovery", data: { state, courses: [] } });
    assert.equal(normalized.state, state);
  }
  assert.equal(projection.normalizePublicProjectionResponse({
    state: "recovery", accessState: "denied", data: { courses: [] },
  }).state, "permission");
});

test("B9 meta stale wins over a ready content payload without aging independent commerce", async () => {
  const app = harness();
  const content = canonicalContentPayload();
  content.meta.stale = true;
  const plan = {
    skuId: "fresh-sku", title: "公开方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "fresh-sku-v1",
  };
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [plan] } : content));
  const { body, headers } = await app.request();
  assert.equal(body.state, "recovery");
  assert.equal(body.stale, true);
  assert.equal(headers["cache-control"], "no-store");
  for (const key of ["courses", "download", "announcements", "compliance"]) {
    assert.equal(body.facets[key].state, "recovery");
    assert.equal(body.facets[key].stale, true);
  }
  assert.equal(body.facets.pricing.state, "ready");
  assert.equal(body.facets.pricing.stale, false);
  assert.equal(body.projection.pricingPlans.length, 1);

  content.data.accessState = "denied";
  const denied = await app.request();
  assert.equal(denied.body.state, "permission");
  assert.equal(denied.body.facets.courses.state, "permission");
  assert.equal(denied.body.facets.pricing.state, "permission");
  assert.equal(denied.body.projection.courses.length, 0);
  assert.equal(denied.body.projection.pricingPlans.length, 0);
});

test("B9 malformed or missing collections are isolated errors, never false empty or cached facts", async () => {
  const keys = { courses: "courses", downloads: "download", announcements: "announcements", compliance: "compliance" };
  for (const [collection, facet] of Object.entries(keys)) {
    for (const malformed of ["missing", "object", "null", "bad-item"]) {
      const app = harness();
      const content = canonicalContentPayload();
      app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : content));
      assert.equal((await app.request()).body.state, "ready");
      if (malformed === "missing") delete content.data[collection];
      else content.data[collection] = malformed === "object" ? { malformed: true } : malformed === "null" ? null : [null];
      const invalid = await app.request();
      assert.equal(invalid.body.facets[facet].state, "error", `${collection}: ${malformed}`);
      assert.equal(invalid.body.facets[facet].errorCode, "PUBLIC_FACET_INVALID");
      assert.equal(invalid.headers["cache-control"], "no-store");
      for (const other of Object.values(keys).filter((item) => item !== facet)) {
        assert.equal(invalid.body.facets[other].state, "ready");
      }
      app.setFetch(async () => { throw new Error("subsequent outage"); });
      assert.equal((await app.request()).body.state, "error", "malformed authoritative data invalidates the older snapshot");
    }
    const app = harness();
    const empty = canonicalContentPayload();
    empty.data[collection] = [];
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : empty));
    const result = await app.request();
    assert.equal(result.body.facets[facet].state, "empty", `${collection}: a real empty array remains empty`);
    assert.match(result.headers["cache-control"], /^public/);
  }
});

test("supported content wrappers use fresh commerce prices and honor their nested access and stale state", async () => {
  const fresh = {
    skuId: "new-sku", title: "当前方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "new-v1",
  };
  for (const wrapper of ["publicProjection", "result"]) {
    const app = harness();
    const inner = {
      courses: [{ id: "course-1", title: "基础英语" }],
      pricingPlans: [{ id: "old-sku", skuId: "old-sku", name: "旧方案", price: "¥1" }],
      skus: [{ id: "old-sku", skuId: "old-sku", name: "旧方案", price: "¥1" }],
    };
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [fresh] } : { [wrapper]: inner }));
    const current = await app.request();
    assert.equal(current.body.state, "ready", wrapper);
    assert.equal(current.body.facets.pricing.state, "ready");
    assert.equal(current.body.projection.pricingPlans.map((plan) => plan.skuId).join(","), "new-sku");
    assert.ok(!JSON.stringify(current.body.projection).includes("old-sku"));

    inner.state = "denied";
    const denied = await app.request();
    assert.equal(denied.body.state, "permission", wrapper);
    assert.equal(denied.body.projection.pricingPlans.length, 0);
    inner.state = "maintenance";
    const maintenance = await app.request();
    assert.equal(maintenance.body.state, "maintenance", wrapper);
    assert.equal(maintenance.body.projection.courses.length, 0);
    delete inner.state;
    inner.stale = true;
    const stale = await app.request();
    assert.equal(stale.body.state, "recovery", wrapper);
    assert.equal(stale.body.facets.courses.stale, true);
    assert.equal(stale.body.facets.pricing.state, "ready");
    assert.equal(stale.body.projection.pricingPlans[0].skuId, "new-sku");
    assert.equal(stale.headers["cache-control"], "no-store");
  }
});

test("BFF keeps legitimate recovery data, time, stale flag and reason", async () => {
  const course = { id: "course-1", title: "基础英语" };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [] }
    : { state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [course] } }));
  const { body, headers } = await app.request();
  assert.equal(body.state, "recovery");
  assert.equal(body.stale, true);
  assert.equal(body.errorCode, "PUBLIC_PROJECTION_STALE");
  assert.equal(body.projection.courses.length, 1);
  assert.equal(body.projection.courses[0].id, "course-1");
  assert.equal(body.projection.generatedAt, "2026-10-03T00:00:00Z");
  assert.equal(body.facets.courses.state, "recovery");
  assert.equal(body.facets.courses.stale, true);
  assert.equal(body.facets.courses.updatedAt, "2026-10-03T00:00:00Z");
  assert.equal(body.facets.courses.errorCode, "PUBLIC_PROJECTION_STALE");
  assert.equal(headers["cache-control"], "no-store");
  assert.equal(headers["x-public-projection-source"], "gateway");
});

test("BFF recovery keeps fresh independent commerce state instead of forcing all facets", async () => {
  const course = { id: "course-1", title: "基础英语" };
  const plans = [{
    skuId: "sku-valid", title: "月度方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "sku-valid-v1",
  }];
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans }
    : { state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [course] } }));
  const { body } = await app.request();
  assert.equal(body.state, "recovery");
  assert.equal(body.projection.courses.length, 1);
  assert.equal(body.facets.pricing.state, "ready");
  assert.equal(body.facets.pricing.errorCode, null);
  assert.equal(body.projection.pricingPlans.length, 1);
  assert.equal(body.facets.courses.state, "recovery");
});

test("BFF still clears permission/error/maintenance content while keeping commerce freshness honest", async () => {
  for (const globalState of ["permission", "error", "maintenance"]) {
    const app = harness();
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
      ? { plans: [] }
      : { state: globalState, errorCode: "UPSTREAM_DENIED", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [{ id: "course-1", title: "基础英语" }] } }));
    const { body } = await app.request();
    assert.equal(body.state, globalState);
    assert.equal(body.projection.courses.length, 0);
    assert.equal(body.projection.generatedAt, null);
    assert.equal(body.stale, false);
    assert.equal(body.facets.courses.updatedAt, globalState === "error" || globalState === "permission" ? null : body.facets.courses.updatedAt);
  }
});

test("BFF sequential recovery updates cached commerce facts and never revives withdrawn plans", async () => {
  const oldPlan = {
    skuId: "withdrawn", title: "Old published plan", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "old-snapshot",
  };
  const newPlan = { ...oldPlan, skuId: "new-plan", priceSnapshotId: "new-snapshot" };
  const recoveryCourse = { id: "current-course", title: "Current recovery course" };
  const recoveryBody = (commerce) => ({
    state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE",
    data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [recoveryCourse] },
    __commerce: commerce,
  });
  for (const nextCatalog of ["empty", "changed", "failed"]) {
    const app = harness();
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [oldPlan] } : readyPayload));
    const first = await app.request();
    assert.equal(first.body.projection.pricingPlans.map((p) => p.skuId).join(","), "withdrawn");
    const commerceFetch = nextCatalog === "failed"
      ? async () => ({ ok: false, status: 503, json: async () => ({}) })
      : async () => ok({ plans: nextCatalog === "changed" ? [newPlan] : [] });
    const recoveryPayload = recoveryBody(nextCatalog);
    app.setFetch(async (url) => {
      if (url.includes("/public/commerce/catalog")) return commerceFetch(url);
      const { __commerce, ...rest } = recoveryPayload;
      return ok(rest);
    });
    const middle = await app.request();
    assert.equal(middle.body.state, "recovery");
    assert.equal(middle.body.stale, true);
    assert.equal(middle.body.projection.courses.map((c) => c.id).join(","), "current-course");
    if (nextCatalog === "empty") assert.equal(middle.body.projection.pricingPlans.map((p) => p.skuId).join(","), "");
    if (nextCatalog === "changed") assert.equal(middle.body.projection.pricingPlans.map((p) => p.skuId).join(","), "new-plan");
    if (nextCatalog === "failed") {
      assert.equal(middle.body.projection.pricingPlans.map((p) => p.skuId).join(","), "");
      assert.equal(middle.body.facets.pricing.state, "error");
    }
    app.setFetch(async () => { throw new Error("synthetic outage"); });
    const last = await app.request();
    assert.equal(last.body.state, "recovery");
    assert.equal(last.body.source, "memory-cache");
    assert.ok(!last.body.projection.pricingPlans.some((p) => p.skuId === "withdrawn"), `revived withdrawn plan after ${nextCatalog}`);
    assert.equal(last.body.projection.pricingPlans.map((p) => p.skuId).join(","), middle.body.projection.pricingPlans.map((p) => p.skuId).join(","));
    assert.equal(last.body.projection.courses.map((c) => c.id).join(","), "current-course");
    if (nextCatalog === "failed") {
      assert.equal(last.body.facets.pricing.state, "error");
      assert.equal(last.body.facets.pricing.errorCode, "PUBLIC_COMMERCE_DEGRADED");
      assert.equal(last.body.commerceState, "error");
      assert.equal(last.body.commerceErrorCode, "PUBLIC_COMMERCE_DEGRADED");
    } else {
      assert.equal(last.body.facets.pricing.state, "recovery");
      assert.equal(last.body.facets.pricing.errorCode, "PUBLIC_PROJECTION_STALE");
      assert.equal(last.body.commerceState, "recovery");
      assert.equal(last.body.commerceErrorCode, "PUBLIC_PROJECTION_STALE");
    }
  }
});

test("BFF recovery does not refresh the 60s cache window", async () => {
  const app = harness();
  await app.request();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [] }
    : { state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [{ id: "current-course", title: "Current recovery course" }] } }));
  await app.request();
  app.advance(60_001);
  app.setFetch(async () => { throw new Error("synthetic outage after TTL"); });
  const last = await app.request();
  assert.equal(last.body.state, "error");
  assert.equal(last.body.projection.courses.length, 0);
  assert.equal(last.headers["cache-control"], "no-store");
});

test("BFF late revoked response cannot refill withdrawn commerce facts", async () => {
  const oldPlan = {
    skuId: "withdrawn", title: "Old published plan", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "old-snapshot",
  };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [oldPlan] } : readyPayload));
  await app.request();
  const gate = deferred();
  const delayed = deferred();
  let contentReads = 0;
  app.setFetch(async (url) => {
    if (url.includes("/public/commerce/catalog")) {
      gate.resolve();
      return delayed.promise;
    }
    contentReads += 1;
    if (contentReads === 1) return ok({ state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [{ id: "current-course", title: "Current recovery course" }] } });
    return { ok: false, status: 410, json: async () => ({}) };
  });
  const inFlight = app.request();
  await gate.promise;
  const revoked = await app.request();
  assert.equal(revoked.body.projection.courses.length, 0);
  delayed.resolve(ok({ plans: [oldPlan] }));
  const late = await inFlight;
  assert.ok(!late.body.projection.pricingPlans.some((p) => p.skuId === "withdrawn"));
  assert.equal(late.headers["cache-control"], "no-store");
});

test("BFF exposes independent pricing facet state instead of hiding commerce failure", async () => {
  const app = harness();
  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? { ok: false, status: 503, json: async () => ({}) }
    : ok(readyPayload));
  const degraded = await app.request();
  assert.equal(degraded.body.state, "ready");
  assert.equal(degraded.body.facets.pricing.state, "error");
  assert.equal(degraded.body.facets.pricing.errorCode, "PUBLIC_COMMERCE_DEGRADED");
  assert.equal(degraded.body.facets.courses.state, "ready");
  assert.equal(degraded.headers["x-public-projection-commerce"], "degraded");
  assert.equal(degraded.headers["cache-control"], "no-store");
});

test("global maintenance/permission/error wins over independent commerce success for pricing", async () => {
  for (const globalState of ["maintenance", "permission", "error"]) {
    const facets = projection.normalizePublicProjectionResponse(
      {
        data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [], pricingPlans: [], skus: [], campaigns: [], downloadChannels: [], announcements: [], complianceNotices: [] },
        state: globalState,
        commerceState: "ready",
        commerceErrorCode: null,
      },
      "zh-CN",
    ).facets;
    assert.equal(facets.pricing.state, globalState);
    assert.equal(facets.courses.state, globalState);
  }
});

test("success and recovery snapshots remain isolated by UI locale", async () => {
  const app = harness();
  await app.request("zh-CN");
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : emptyPayload));
  assert.equal((await app.request("en-US")).body.state, "empty");
  app.setFetch(async () => { throw new Error("outage"); });
  assert.equal((await app.request("zh-CN")).body.state, "recovery");
  assert.equal((await app.request("en-US")).body.state, "error");
  assert.ok(app.calls.some((url) => url.endsWith("?uiLocale=en-US")));
});

test("bad private URL fails closed and commerce degradation does not enter shared cache", async () => {
  const invalid = harness("javascript:alert(1)");
  const blocked = await invalid.request();
  assert.equal(blocked.body.state, "error");
  assert.equal(blocked.headers["cache-control"], "no-store");
  assert.equal(invalid.calls.length, 0);

  const app = harness();
  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? { ok: false, status: 503, json: async () => ({}) }
    : ok(readyPayload));
  const degraded = await app.request();
  assert.equal(degraded.body.state, "ready");
  assert.equal(degraded.headers["x-public-projection-commerce"], "degraded");
  assert.equal(degraded.headers["cache-control"], "no-store");
});

test("an empty or failed commerce catalog never revives prices from content", async () => {
  const contentWithOldOffer = {
    data: {
      uiLocale: "zh-CN",
      courses: [{ id: "course-1", title: "基础英语" }],
      pricingPlans: [{ id: "old-plan", name: "旧价格", price: "¥9", availability: "AVAILABLE" }],
      skus: [{ skuId: "old-plan", name: "旧价格", price: "¥9", availability: "AVAILABLE" }],
    },
  };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [] } : contentWithOldOffer));
  const empty = await app.request();
  assert.equal(empty.body.projection.pricingPlans.length, 0);
  assert.equal(empty.body.projection.skus.length, 0);

  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? { ok: false, status: 503, json: async () => ({}) }
    : ok(contentWithOldOffer));
  const degraded = await app.request();
  assert.equal(degraded.body.projection.pricingPlans.length, 0);
  assert.equal(degraded.body.projection.skus.length, 0);
  assert.equal(degraded.headers["cache-control"], "no-store");
});

test("public commerce accepts the contract envelope and the existing legacy shape", async () => {
  const plan = {
    planId: "plan-public", skuId: "sku-public", title: "公开方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "sku-public-v1",
  };
  const data = {
    catalogVersion: "commerce-public-v1", uiLocale: "zh-CN", contentLocale: "en-US",
    plans: [plan], publishedAt: "2026-11-03T00:00:00Z", checkoutPath: "/pricing",
    productionPaymentEnabled: false, autoRenewalEnabled: false,
  };
  const meta = {
    requestId: "request-1", traceId: "0123456789abcdef0123456789abcdef", apiVersion: "v1",
    schemaVersion: "1.0.0", serverTime: "2026-11-03T00:00:00Z",
  };
  for (const catalog of [{ data, meta }, data]) {
    const app = harness();
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? catalog : readyPayload));
    const { body, headers } = await app.request();
    assert.equal(headers["x-public-projection-commerce"], "gateway");
    assert.equal(body.facets.pricing.state, "ready");
    assert.deepEqual(body.projection.pricingPlans.map((item) => item.skuId), ["sku-public"]);
  }
});

test("a malformed commerce envelope cannot fall back to sibling legacy plans", async () => {
  const plan = {
    skuId: "old-plan", title: "旧方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "old-plan-v1",
  };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [plan] } : readyPayload));
  assert.equal((await app.request()).body.projection.pricingPlans.length, 1);
  for (const catalog of [{ data: null, plans: [plan] }, { data: { plans: "bad" }, plans: [plan] }, { data: {} }]) {
    app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? catalog : readyPayload));
    const { body, headers } = await app.request();
    assert.equal(headers["x-public-projection-commerce"], "degraded");
    assert.equal(headers["cache-control"], "no-store");
    assert.equal(body.facets.pricing.state, "error");
    assert.equal(body.projection.pricingPlans.length, 0);
    assert.equal(body.projection.courses.length, 1);
  }
});

test("malformed public offers are withheld instead of displaying a placeholder price", async () => {
  const app = harness();
  const valid = {
    skuId: "sku-valid", title: "月度方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "sku-valid-v1",
  };
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [
      valid,
      { ...valid, skuId: "sku-invalid-currency", currency: "INVALID" },
      { ...valid, skuId: "sku-no-snapshot", priceSnapshotId: "" },
      { ...valid, skuId: "sku-invalid-term", billingPeriod: "WEEK" },
      { ...valid, skuId: "sku-fractional", amountMinor: 12.5 },
    ] }
    : readyPayload));
  const { body } = await app.request();
  assert.deepEqual(body.projection.pricingPlans.map((plan) => plan.skuId), ["sku-valid"]);
  assert.equal(body.projection.pricingPlans[0].price, "¥12.99");
  assert.deepEqual(body.projection.skus.map((sku) => sku.skuId), ["sku-valid"]);
});

test("Nuxt and full Compose keep the internal address private", async () => {
  const [config, compose, envExample] = await Promise.all([
    read("nuxt.config.ts"),
    readFile(join(siteRoot, "../../infra/docker/clyunedev/docker-compose.full.yml"), "utf8"),
    readFile(join(siteRoot, "../../infra/docker/clyunedev/clyunedev.full.env.example"), "utf8"),
  ]);
  assert.match(config, /runtimeConfig:\s*\{\s*gatewayInternalBaseUrl,\s*public:/);
  assert.match(config, /NUXT_PUBLIC_GATEWAY_BASE_URL/);
  assert.match(compose, /official-site:\s*\n\s*environment:\s*\n\s*NUXT_GATEWAY_INTERNAL_BASE_URL:/);
  assert.match(envExample, /NUXT_GATEWAY_INTERNAL_BASE_URL=http:\/\/api-gateway:18070\/api\/v1/);
});
