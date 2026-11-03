import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { publicRoutes } from "../utils/site-content.mjs";

const root = join(import.meta.dirname, "..");
const [config, robots, sitemap, seo] = await Promise.all([
  "nuxt.config.ts", "server/routes/robots.txt.ts", "server/routes/sitemap.xml.ts", "utils/seo.ts",
].map((file) => readFile(join(root, file), "utf8")));

function load(source, globals) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, URL, ...globals });
  return module.exports;
}

test("robots, sitemap and canonical use the same runtime site URL", () => {
  // Pre-rendered copies would mask the runtime route handlers after deployment.
  assert.doesNotMatch(config, /prerender\s*:\s*\{[\s\S]*?["']\/(?:robots\.txt|sitemap\.xml)["']/);
  let siteUrl = "";
  let head;
  const globals = {
    defineEventHandler: (handler) => handler,
    useRuntimeConfig: () => ({ public: { siteUrl } }),
    setResponseHeader: (event, name, value) => { event.headers[name] = value; },
    useSeoMeta: () => {},
    useHead: (value) => { head = value; },
    require: (name) => {
      if (name === "~/utils/site-content.mjs") return { publicRoutes };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  const robotsRoute = load(robots, globals).default;
  const sitemapRoute = load(sitemap, globals).default;
  const { useOfficialSeo } = load(seo, globals);
  for (siteUrl of ["https://preview.example.invalid", "https://other.example.invalid"]) {
    const robotsEvent = { headers: {} };
    const sitemapEvent = { headers: {} };
    const robotsText = robotsRoute(robotsEvent);
    const sitemapText = sitemapRoute(sitemapEvent);
    useOfficialSeo({ title: "价格", description: "公开信息", path: "/pricing" });
    assert.match(robotsText, new RegExp(`Sitemap: ${siteUrl.replaceAll(".", "\\.")}/sitemap\\.xml`));
    assert.ok(sitemapText.includes(`<loc>${siteUrl}/pricing</loc>`));
    assert.equal(head.link[0].href, `${siteUrl}/pricing`);
    assert.equal(robotsEvent.headers["content-type"], "text/plain; charset=utf-8");
    assert.equal(sitemapEvent.headers["content-type"], "application/xml; charset=utf-8");
    assert.ok(!`${robotsText}${sitemapText}${JSON.stringify(head)}`.includes("127.0.0.1"));
  }
});
