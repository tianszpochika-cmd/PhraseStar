# Dependency lockfile candidate (not complete)

Worktree: `/Users/Admin/.codex/worktrees/mobile-resume-dependencies-20261107/cloudstudy`
Base: `dev` `f69fd71f` (uncommitted). Toolchain: Node `v20.19.5`, pnpm `10.19.0`, registry `https://registry.npmjs.org/`.
No `node_modules` was created. No runtime, typecheck, or build was run. No Git commit, index change, or branch.

This candidate is not complete. Fail-closed high+critical is still 1, and the mobile/uni build that would exercise Vue 3.5.45 under the unchanged uni-app release was not run.

## Audit counts

`pnpm audit --json` metadata `vulnerabilities`. The policy sum is high + critical.

| | info | low | moderate | high | critical | high+critical | high/critical advisory objects | all advisories |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Before (`audit-before.json`) | 0 | 19 | 44 | 33 | 4 | 37 | 36 | 92 |
| After (`audit-after.json`) | 0 | 11 | 19 | 1 | 0 | 1 | 1 | 28 |

Before exit 1. After exit 1. The extra before-object versus the 36 high/critical keys was the second `@vue/server-renderer` finding (3.5.41 and 3.4.21) inside advisory 1241259. Both are gone.

## Unresolved high/critical

One object remains.

- npm advisory `1242661`, `GHSA-587h-7wmj-h5pm`, high, module `vite`
- installed `8.2.2`, vulnerable `>=8.2.0 <=8.2.3`, patched `>=8.2.4`
- path: `apps__mobile>vite`
- why it stays: `@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822` peers `vite` exactly `8.2.2`. The uni-app release was not changed. `8.2.4` is published (`https://registry.npmjs.org/vite/8.2.4` returned 200 in the earlier version check) and was not pinned.

The same installed `vite@8.2.2` still matches these non-blocking advisories, all vulnerable `>=8.2.0 <=8.2.3` and patched `>=8.2.4`: moderate `1242625`, `1242654`, `1242733`, `1242736`; low `1242727`.

## Cleared by this candidate

Confirmed absent from `audit-after.json`: `@vue/server-renderer`, `simple-git`, `@simple-git/argv-parser`, `node-forge`, `devalue`, `seroval`, `adm-zip`, `brace-expansion`, `body-parser`, `proxy-addr`, `shell-quote`, `source-map-js`, `launch-editor`.

`node-forge` was not waived. Official `GHSA-86w9-cpqp-85rv` (npm `1240912`) has vulnerable range `<=1.4.0` and `first_patched_version: null`. Installed `1.4.3` is outside that range. `listhen>node-forge` is pinned to `1.4.3`. Audit no longer lists `node-forge` at any severity.

`simple-git@4.0.1` / `@simple-git/argv-parser@2.0.1` were not forced. `@nuxt/devtools@3.4.4` publishes no `simple-git` dependency. `nuxt@3.21.11` accepts `@nuxt/devtools` `^3.4.1`, so `3.4.4` is an in-range parent update. `simple-git@4.0.1` still depends on `@simple-git/argv-parser@2.0.0`.

## Manifests changed

Git status is only these six files. Root `package.json` and `packages/*/package.json` were not changed. Ports in the app scripts were not changed.

- `apps/mobile/package.json`: direct Vue set `3.5.41` to `3.5.45` (`vue`, `@vue/compiler-sfc`, `@vue/compiler-dom`, `@vue/reactivity`, `@vue/runtime-core`, `@vue/runtime-dom`, `@vue/shared`). `vite` stays `8.2.2`. Every `@dcloudio/*` stays `3.0.0-alpha-1000920260909822`.
- `apps/admin-web/package.json`: `vue` `^3.4.0` to `3.5.45`; `vite` `6.4.3` to `6.4.5`.
- `apps/learner-web/package.json`: `vue` `^3.4.0` to `3.5.45`; `vite` `6.4.3` to `6.4.5`.
- `apps/official-site/package.json`: `vue` `^3.4.0` to `3.5.45`. `nuxt` stays `^3.11.0` (locked `3.21.11`).
- `pnpm-workspace.yaml` and the copied `pnpm-lock.yaml` `settings.overrides`.

Existing overrides kept: `express>path-to-regexp` `0.1.13`, `@dcloudio/uni-nvue-styler>postcss` `8.5.23`, `@dcloudio/uni-cli-shared>adm-zip` `0.6.1`, `@dcloudio/uni-cli-shared>@intlify/core-base` `9.1.11`, `@intlify/message-resolver` `9.1.11`, `svgo` `>=4.1.0`.

Added overrides:

- `@dcloudio/uni-uts-v1>adm-zip`: `0.6.1`
- `brace-expansion@>=2.0.0 <3.0.0`: `2.1.7`
- `brace-expansion@>=5.0.0 <6.0.0`: `5.0.12`
- no `minimatch>brace-expansion` selector
- `devalue@>=5.9.0 <6.0.0`: `5.9.4`
- `listhen>node-forge`: `1.4.3`
- `@nuxt/vite-builder>seroval`: `1.6.12`
- `source-map-js`: `1.2.2`
- `express>proxy-addr`: `2.0.8`
- `express>body-parser`: `1.20.9`
- `launch-editor>shell-quote`: `1.12.0`
- `nuxt>@nuxt/devtools`: `3.4.4`
- `@nuxt/devtools>launch-editor`: `2.14.2`
- `@nuxt/vite-builder>vite`: `7.3.7`
- Vue version selectors from `3.4.21` / `3.5.41` to `3.5.45` for `vue` and the `@vue/compiler-*`, `@vue/server-renderer`, `@vue/shared`, `@vue/runtime-core`, `@vue/runtime-dom`, `@vue/reactivity` lines listed in `pnpm-workspace.yaml`

A first lockfile pass used `vite@>=7.0.0 <8.0.0: 7.3.7`. That rewrote multi-major peer ranges (`@vitejs/plugin-vue@6`, `@nuxt/devtools`, `unplugin`, and others) to exact `vite: 7.3.7` and warned `unmet peer vite@7.3.7: found 8.2.2`. That selector was removed before the after-audit. The current parent selector does not do that. Lock metadata peers for those Vite plugins are the published ranges again, including `@vitejs/plugin-vue@6` `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` and `@nuxt/devtools@3.4.4` `>=6.0`.

Installed Vite lines are only `6.4.5`, `7.3.7`, and `8.2.2`. `vite-node@5.3.0` depends on `vite` `^7.3.1` and resolved `7.3.7` without a second override. No `7.3.6` or `6.4.3` remains. No `vue@3.4.21` or `vue@3.5.41` package snapshot remains; those versions appear only as override selectors.

## Registry primary URLs

Live `GET https://registry.npmjs.org/<name>/<version>` on 2026-11-07. `dist.tarball` values:

- https://registry.npmjs.org/vue/-/vue-3.5.45.tgz
- https://registry.npmjs.org/@vue/shared/-/shared-3.5.45.tgz
- https://registry.npmjs.org/@vue/compiler-dom/-/compiler-dom-3.5.45.tgz
- https://registry.npmjs.org/@vue/compiler-sfc/-/compiler-sfc-3.5.45.tgz
- https://registry.npmjs.org/@vue/compiler-core/-/compiler-core-3.5.45.tgz
- https://registry.npmjs.org/@vue/compiler-ssr/-/compiler-ssr-3.5.45.tgz
- https://registry.npmjs.org/@vue/server-renderer/-/server-renderer-3.5.45.tgz
- https://registry.npmjs.org/@vue/runtime-core/-/runtime-core-3.5.45.tgz
- https://registry.npmjs.org/@vue/runtime-dom/-/runtime-dom-3.5.45.tgz
- https://registry.npmjs.org/@vue/reactivity/-/reactivity-3.5.45.tgz
- https://registry.npmjs.org/vite/-/vite-6.4.5.tgz
- https://registry.npmjs.org/vite/-/vite-7.3.7.tgz
- https://registry.npmjs.org/vite/-/vite-8.2.2.tgz
- https://registry.npmjs.org/adm-zip/-/adm-zip-0.6.1.tgz
- https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.7.tgz
- https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz
- https://registry.npmjs.org/devalue/-/devalue-5.9.4.tgz
- https://registry.npmjs.org/node-forge/-/node-forge-1.4.3.tgz
- https://registry.npmjs.org/seroval/-/seroval-1.6.12.tgz
- https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz
- https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.8.tgz
- https://registry.npmjs.org/body-parser/-/body-parser-1.20.9.tgz
- https://registry.npmjs.org/shell-quote/-/shell-quote-1.12.0.tgz
- https://registry.npmjs.org/@nuxt/devtools/-/devtools-3.4.4.tgz
- https://registry.npmjs.org/launch-editor/-/launch-editor-2.14.2.tgz
- https://registry.npmjs.org/@nuxt/kit/-/kit-4.6.4.tgz
- https://registry.npmjs.org/@nuxt/vite-builder/-/vite-builder-3.21.11.tgz
- https://registry.npmjs.org/vite-node/-/vite-node-5.3.0.tgz

Parent ranges checked on those documents:

- `@nuxt/vite-builder@3.21.11` depends on `vite` `^7.3.6` (7.3.7 is inside) and `seroval` `^1.6.2` (1.6.12 is inside). Peer `vue` `^3.3.4`. Engines `node: ^20.19.0 || >=22.12.0`.
- `vite-node@5.3.0` depends on `vite` `^7.3.1`.
- `@nuxt/devtools@3.4.4` has no `simple-git` dependency, depends on `launch-editor` `^2.14.2` and `@nuxt/kit` `^4.6.1`, peers `vite` `>=6.0`.
- `@nuxt/kit@4.6.4` engines `node: ^20.19.0 || >=22.12.0` (matches Node 20.19.5).
- Lock snapshot `vue@3.5.45` depends on `@vue/compiler-dom`, `@vue/compiler-sfc`, `@vue/runtime-dom`, `@vue/server-renderer`, and `@vue/shared`, each `3.5.45`.

## Peer and compatibility risk

- Vue compilers that uni-app resolved at `3.4.21` now resolve at `3.5.45` with the direct mobile Vue set. The uni-app release itself is unchanged. Mobile build was not run, so this alignment is unverified at runtime.
- pnpm stored some overlapping Vue peer ranges as exact `vue: 3.5.45` in lock metadata (`pinia@2.3.1`, `element-plus@2.14.4`, `@nuxt/vite-builder@3.21.11`, `@vitejs/plugin-vue` 5.2.4/6.0.7/6.0.8, `@vueuse/core@14.3.0`, `vue-router` 4.4.4/4.6.4, and the other names in the metadata scan). Published peer ranges were not edited. The lockfile-only log did not warn about an unmet Vue peer. The tree contains only `vue@3.5.45`.
- `@nuxt/devtools@3.4.4` resolves its own `@nuxt/kit@4.6.4`. Nuxt's own `@nuxt/kit` stays `3.21.11`. `@nuxt/kit@4.5.2` is still present for `@dxup/nuxt@0.5.9`.
- Pre-existing optional peer, still warned: `@nuxt/cli@3.37.0` wants optional `@nuxt/schema@^4.4.6` and finds `3.21.11`. Nuxt was not moved to 4.
- `express@4.20.0` (exact dependency of the uni Vite plugin) publishes `body-parser` `1.20.3`. The override installs `1.20.9` on that edge. `proxy-addr@2.0.8` is inside express `~2.0.7`.
- `shell-quote@1.12.0` is inside `launch-editor@2.14.2`'s `^1.8.4` / `^1.10.0` range.
- Vite 6.4.5 satisfies `@vitejs/plugin-vue@5` `^5 || ^6`. Vite 7.3.7 satisfies `@nuxt/vite-builder` `^7.3.6`. Vite 8.2.2 stays on the uni exact peer and remains the high finding.
- Deprecated subdependencies warned, not high/critical: `glob@10.5.0`, `unplugin-vue-router@0.19.2`.
- Pinia, Nuxt, and Element Plus identities were not switched (no Pinia 4, no Nuxt 4, no Element Plus bump).

## Checks performed

- `pnpm install --lockfile-only --ignore-scripts`: exit 0, 1m 44.4s, resolved 1149, downloaded 0, added 0. Log: `pnpm-lockfile-only-2.log`. Peer warning left: optional `@nuxt/schema` only.
- `pnpm audit --json`: exit 1, counts above. Log JSON: `audit-after.json`.
- `pnpm install --lockfile-only --frozen-lockfile --ignore-scripts`: exit 0, 258ms. Log: `pnpm-frozen-lockfile.log`.
- Root and `apps/mobile` `node_modules`: absent after both installs.
- Not run: install into `node_modules`, scripts, runtime, typecheck, build, Docker, browsers, listeners, `scripts/audit/p1r-dependency-audit.mjs`.
