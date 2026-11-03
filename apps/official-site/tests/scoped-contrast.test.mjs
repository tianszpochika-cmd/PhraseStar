import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { parse, compileStyle } = require("vue/compiler-sfc");
const siteRoot = join(import.meta.dirname, "..");
const nakedRoot = /(?:^|[{},])\s*(?:html|:root)(?:\[[^\]]+\])*\s*(?=[,{])/m;

async function vueFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await vueFiles(path));
    else if (entry.name.endsWith(".vue")) result.push(path);
  }
  return result;
}

test("scoped high-contrast styles retain their targets instead of styling the document root", async () => {
  const compile = (source) => compileStyle({ source, filename: "sentinel.vue", id: "data-v-contrast-test", scoped: true });
  const broken = compile(':global(html[data-theme="high-contrast"]) .sentinel { border: 1px solid; }');
  const corrected = compile('html[data-theme="high-contrast"] .sentinel { border: 1px solid; }');
  assert.equal(nakedRoot.test(broken.code), true, "the regression detects Vue dropping the target");
  assert.equal(nakedRoot.test(corrected.code), false);
  assert.match(corrected.code, /\.sentinel\[data-v-contrast-test\]/);
  const files = [
    join(siteRoot, "app.vue"), join(siteRoot, "error.vue"),
    ...await vueFiles(join(siteRoot, "pages")), ...await vueFiles(join(siteRoot, "components")),
  ];
  let checked = 0;
  for (const file of files) {
    const name = relative(siteRoot, file);
    const { descriptor, errors } = parse(await readFile(file, "utf8"), { filename: name });
    assert.equal(errors.length, 0, `${name}: SFC parse`);
    for (const style of descriptor.styles.filter((item) => item.scoped)) {
      checked += 1;
      // Vue drops any selector following this partial :global() form.
      assert.equal(/:global\(\s*(?:html\b|:root\b)/.test(style.content), false, `${name}: partial global root selector`);
      const compiled = compileStyle({ source: style.content, filename: name, id: "data-v-contrast-test", scoped: true });
      assert.equal(compiled.errors.length, 0, `${name}: scoped CSS compile`);
      assert.equal(nakedRoot.test(compiled.code), false, `${name}: root-only theme selector`);
    }
  }
  assert.ok(checked > 0, "scoped component styles were inspected");
});
