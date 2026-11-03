import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { computed, nextTick, ref, watch } from "vue";

const siteRoot = join(import.meta.dirname, "..");
const [motionSource, engineSource] = await Promise.all([
  readFile(join(siteRoot, "composables/useSiteMotion.ts"), "utf8"),
  readFile(join(siteRoot, "../../packages/performance/src/index.ts"), "utf8"),
]);

function load(source, globals = {}) {
  const compiled = ts.transpileModule(source.replaceAll("import.meta.client", "true"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, ...globals });
  return module.exports;
}

function setup({ cores, memory, savedLevel, reduced = false }) {
  const values = new Map(savedLevel ? [["yx.official.performance", savedLevel]] : []);
  const listeners = new Set();
  const mounted = [];
  const disposers = [];
  const state = new Map();
  const media = {
    matches: reduced,
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
  };
  const document = { documentElement: { dataset: {} } };
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const engine = load(engineSource);
  const motion = load(motionSource, {
    require: (name) => {
      if (name === "@englishflow/performance") return engine;
      throw new Error(`Unexpected import: ${name}`);
    },
    computed, watch, document, localStorage,
    navigator: { hardwareConcurrency: cores, deviceMemory: memory },
    matchMedia: () => media,
    useState: (key, initialize) => {
      if (!state.has(key)) state.set(key, ref(initialize()));
      return state.get(key);
    },
    onMounted: (callback) => mounted.push(callback),
    onBeforeUnmount: (callback) => disposers.push(callback),
  });
  const instance = motion.installSiteMotion();
  mounted.forEach((callback) => callback());
  return {
    instance, document, values, listeners,
    async reduce(next) {
      if (media.matches !== next) {
        media.matches = next;
        for (const listener of listeners) listener();
        await nextTick();
      }
    },
    async dispose() { disposers.forEach((callback) => callback()); await nextTick(); },
  };
}

test("system reduced motion temporarily overrides device and saved quality without rewriting either", async () => {
  for (const scenario of [
    { cores: 2, memory: 2, expected: "Medium", reduced: false },
    { cores: 8, memory: 8, expected: "Medium", savedLevel: "Medium", reduced: false },
    { cores: 2, memory: 2, expected: "High", savedLevel: "High", reduced: true },
  ]) {
    const site = setup(scenario);
    await nextTick();
    const savedBefore = site.values.get("yx.official.performance");
    assert.equal(site.instance.level.value, scenario.reduced ? "Performance" : scenario.expected);
    await site.reduce(true);
    assert.equal(site.instance.level.value, "Performance");
    assert.equal(site.document.documentElement.dataset.motion, "off");
    await site.reduce(false);
    assert.equal(site.instance.level.value, scenario.expected);
    assert.equal(site.document.documentElement.dataset.quality, scenario.expected);
    assert.equal(site.document.documentElement.dataset.motion, "on");
    assert.equal(site.values.get("yx.official.performance"), savedBefore);
    assert.equal(site.values.has("yx.official.performance:motion"), false);
    await site.dispose();
    assert.equal(site.listeners.size, 0);
  }
});

test("an explicit quality choice made during reduced motion stays saved but cannot enable motion", async () => {
  const site = setup({ cores: 8, memory: 8, reduced: true });
  site.instance.level.value = "Medium";
  await nextTick();
  assert.equal(site.values.get("yx.official.performance"), "Medium");
  assert.equal(site.instance.level.value, "Performance");
  assert.equal(site.document.documentElement.dataset.motion, "off");
  await site.reduce(false);
  assert.equal(site.instance.level.value, "Medium");
  assert.equal(site.document.documentElement.dataset.motion, "on");
  await site.dispose();
});
