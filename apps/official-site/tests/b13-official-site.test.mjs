import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  appendCampaignParams,
  buildLearnerLoginLink,
  buildLearnerLink,
  preserveCampaignParams,
  safePublicHref,
  safePublicReturnTo,
} from "../utils/public-links.mjs";
import {
  PUBLIC_EXTENDED_STATES,
  resolvePublicPageState,
  resolvePublicState,
} from "../utils/public-state.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(testDir, "..");

async function collectSourceFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.name === ".nuxt" ||
      entry.name === ".output" ||
      entry.name === "node_modules"
    )
      continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await collectSourceFiles(absolute, files);
    else files.push(absolute);
  }
  return files;
}

async function source(relativePath) {
  return readFile(join(siteRoot, relativePath), "utf8");
}

test("B13 公开链接只允许受控 origin，并保留 UTM 而不接受 open redirect", () => {
  assert.equal(
    safePublicHref("/download", {
      siteUrl: "https://www.example.test",
      learnerWebUrl: "https://study.example.test",
    }),
    "/download",
  );
  assert.equal(
    safePublicHref("//evil.example", { siteUrl: "https://www.example.test" }),
    null,
  );
  assert.equal(
    safePublicHref("javascript:alert(1)", {
      siteUrl: "https://www.example.test",
    }),
    null,
  );
  assert.equal(
    safePublicHref("https://evil.example", {
      siteUrl: "https://www.example.test",
    }),
    null,
  );
  assert.equal(
    safePublicHref("https://apps.example.test/download", {
      allowedOrigins: ["https://apps.example.test"],
    }),
    "https://apps.example.test/download",
  );

  assert.deepEqual(
    preserveCampaignParams({
      utm_source: "newsletter",
      utm_campaign: ["b13"],
      redirect: "https://evil.example",
    }),
    {
      utm_source: "newsletter",
      utm_campaign: "b13",
    },
  );
  assert.equal(
    appendCampaignParams("/pricing?intent=review", { utm_medium: "email" }),
    "/pricing?intent=review&utm_medium=email",
  );
  assert.match(
    buildLearnerLink("https://study.example.test", "/pricing", {
      skuId: "sku-pro",
      utm_source: "site",
    }),
    /skuId=sku-pro/,
  );
  assert.match(
    buildLearnerLoginLink("https://study.example.test", {
      returnTo: "https://evil.example/checkout",
      campaignParams: { utm_source: "official" },
    }),
    /returnTo=%2Fhome/,
  );
  assert.match(
    buildLearnerLoginLink("https://study.example.test", {
      returnTo: "/pricing?intent=review",
      campaignParams: { utm_source: "official" },
    }),
    /utm_source=official/,
  );
});

test("public links reject control characters and remain same-origin without campaign parameters", () => {
  const options = {
    siteUrl: "https://www.example.test",
    allowedOrigins: ["https://apps.example.test"],
  };
  for (const character of ["\n", "\r", "\t", "\u0000", "\u007f"]) {
    const attack = `/${character}/evil.example/path`;
    assert.equal(safePublicHref(attack, options), null);
    assert.equal(appendCampaignParams(safePublicHref(attack, options), {}), null);
  }
  for (const attack of [
    "//evil.example/path", "/\\evil.example/path", "https://user:pass@apps.example.test/path",
    "/a/..//evil.example/path", "/.//evil.example/path", "/%2e%2e//evil.example/path",
  ]) {
    assert.equal(safePublicHref(attack, options), null);
    assert.equal(appendCampaignParams(safePublicHref(attack, options), {}), null);
  }
  assert.equal(safePublicHref("/a/../announcements?item=1#details", options), "/announcements?item=1#details");
  assert.equal(safePublicHref("https://apps.example.test/download", options), "https://apps.example.test/download");
  for (const attack of ["/a/..//evil.example/path", "/.//evil.example/path", "/%2e%2e//evil.example/path", "/\nevil"]) {
    assert.equal(safePublicReturnTo(attack), "/home");
    const login = new URL(buildLearnerLoginLink("https://study.example.test", { returnTo: attack }));
    assert.equal(login.searchParams.get("returnTo"), "/home");
  }
  assert.equal(safePublicReturnTo("/a/../home?tab=one"), "/home?tab=one");
});

test("B13 官网状态覆盖 loading/empty/error/permission/recovery/maintenance", () => {
  for (const state of [
    "loading",
    "empty",
    "error",
    "permission",
    "recovery",
    "maintenance",
  ]) {
    assert.equal(resolvePublicState(state), state);
  }
  assert.ok(PUBLIC_EXTENDED_STATES.includes("maintenance"));
  assert.equal(
    resolvePublicPageState("ready", "maintenance", true),
    "maintenance",
  );
  assert.equal(resolvePublicPageState("ready", "ready", false), "empty");
  assert.equal(
    resolvePublicPageState("permission", "ready", true),
    "permission",
  );
});

test("R1-001 保留公开投影兼容，价格/下载独立空态且不展示购买入口", async () => {
  const projection = await source("utils/public-projection.ts");
  const pricing = await source("pages/pricing.vue");
  const sku = await source("components/PublicSkuCard.vue");
  const campaign = await source("components/PublicCampaignCard.vue");
  const download = await source("pages/download.vue");
  const catalog = await source("components/v1/experience/CatalogView.vue");
  const copy = await readFile(join(siteRoot, "../../packages/i18n/src/official-site-v1/experience.ts"), "utf8");

  for (const token of [
    "PublicSkuProjection",
    "PublicEntitlementProjection",
    "PublicCampaignProjection",
    "normalizePublicProjectionResponse",
    "maintenance",
    "eligibility",
  ]) {
    assert.match(projection, new RegExp(token));
  }
  assert.match(pricing, /getFacet\("pricing"\)/);
  assert.match(download, /getFacet\("download"\)/);
  for (const [page, kind] of [[pricing, "pricing"], [download, "download"]]) {
    assert.match(page, new RegExp(`<CatalogView kind="${kind}"[^>]*:state="facet.state"[^>]*:empty="catalogEmpty"[^>]*@retry="load"`));
    assert.match(page, /value\.stale/);
    assert.doesNotMatch(page, /navigateTo|redirectCode/);
  }
  assert.match(catalog, /props\.state === "ready" && !props\.empty/);
  assert.match(catalog, /<PublicStatus v-else[^>]*:state="displayState"[^>]*emptyTitle[^>]*emptyMessage[^>]*@retry="retryFromStatus"/);
  assert.match(catalog, /function retryFromStatus\(\)[\s\S]*?emit\("retry"\)/);
  assert.match(copy, /emptyTitle: "收费方案暂未开放"/);
  assert.match(copy, /emptyTitle: "下载准备中"/);
  assert.doesNotMatch(pricing, /navigateTo|redirectCode/);
  assert.match(sku, /entitlement-list/);
  assert.match(campaign, /safe|publicLink|authLink/);
  assert.doesNotMatch(pricing, /PublicSkuCard|jsonld-pricing-public-offers/);
  assert.doesNotMatch(
    `${pricing}\n${download}\n${catalog}`,
    /createOrder|\/orders|payment|entitlement\/write/i,
  );
});

test("B13 官网只读取公开投影，不包含订单/支付/权益写接口或客户端事实写入", async () => {
  const files = await collectSourceFiles(join(siteRoot, "pages"));
  files.push(...(await collectSourceFiles(join(siteRoot, "composables"))));
  files.push(...(await collectSourceFiles(join(siteRoot, "server"))));
  const code = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.match(code, /public-projection/);
  assert.doesNotMatch(
    code,
    /createOrder|createPayment|createEntitlement|orderService|paymentService/i,
  );
  assert.doesNotMatch(
    code,
    /(?:method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)|\$fetch\s*\(|useFetch\s*\()/i,
  );
  assert.doesNotMatch(
    code,
    /(?:href|to)=\"[^\"]*\b(?:orders|checkout|payment)\b/i,
  );
});

test("B13 官网保留 SSR/SEO/structured data、移动入口和 token 适配", async () => {
  const config = await source("nuxt.config.ts");
  const seo = await source("utils/seo.ts");
  const app = await source("app.vue");
  const css = await source("assets/css/main.css");
  const designSystem = await source("utils/design-system.ts");
  const header = await source("components/SiteHeader.vue");

  assert.match(config, /ssr: true/);
  assert.match(config, /structured|theme-color|sitemap\.xml/i);
  assert.match(seo, /application\/ld\+json/);
  assert.match(app, /englishflow-official-site-tokens/);
  assert.match(header, /aria-expanded/);
  assert.match(designSystem, /var\(--ef-color-action-primary(?:,|\))/);
  assert.match(
    designSystem,
    /var\(--ef-color-status-(?:success|warning|danger|info)(?:,|\))/,
  );
  assert.doesNotMatch(
    css,
    /--ef-color-(?:brand-primary|brand-secondary|success|warning|danger|info):\s*#[0-9a-f]/i,
  );
});
