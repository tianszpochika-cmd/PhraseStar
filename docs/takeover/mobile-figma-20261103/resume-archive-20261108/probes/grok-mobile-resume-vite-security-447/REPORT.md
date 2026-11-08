# G447 controlled experiment — mobile Vite 8.2.4 + one parent peer override

**Verdict: EXPERIMENT REVIEWABLE. High/critical = 0. Native host is not PASS. Not an upstream support claim.**

This is **not** the G440/B153 partial candidate. G440 left high gate FAIL 1 (`vite@8.2.2`). B153 source and H5 remain recoverable at commit `30985b80` and freeze `supervision resume-20261108/dependency-440-reviewed`. Root reviews the ADR before integration and will independently review this H5 runtime later.

- Checkout: `/Users/Admin/.codex/worktrees/mobile-deps-20261108/cloudstudy`
- HEAD (detached, unchanged): `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`
- Toolchain: Node `v20.19.5`, pnpm `10.19.0`
- Disk: verify start **12.15 GiB**, end **12.01 GiB**, floor 8 GiB held
- Git: no commit, index, or branch mutation
- Allowed writes only: `apps/mobile/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- No pnpm patch metadata file (none required)
- Logs: `/tmp/grok-mobile-resume-vite-security-447/`
- Old G440 reports: **not altered**

## What changed (application decision)

| item | B153 / G440 | this experiment |
|---|---|---|
| mobile `vite` | `8.2.2` | `8.2.4` |
| parent override | none for uni plugin | `'@dcloudio/vite-plugin-uni>vite': 8.2.4` |
| `@dcloudio/*` 10.x family | `3.0.0-alpha-1000920260909822` | same |
| Vue / Nuxt / Pinia / Element Plus | 3.5.45 / 3.21.11 / 2.3.1 / 2.14.4 | same |
| admin/learner Vite | 6.4.5 | same |
| `@nuxt/vite-builder>vite` | 7.3.7 | same |
| published plugin peer | `vite: 8.2.2` | still `8.2.2` in installed package.json |
| lock snapshot plugin peer | `8.2.2` | rewritten to `8.2.4` |

`@vitejs/plugin-vue@6.0.7` published peer `^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0` was **not** rewritten.

## Source hashes

Experiment files (working tree now):

| path | sha256 | bytes |
|---|---|---:|
| `apps/mobile/package.json` | `e08004d99a0486f6cb56fa2cca5f60f4e22455cc6fc5e0dff09b9e1fbfcad298` | 1909 |
| `pnpm-workspace.yaml` | `e0dec117f697e0c96824fc5b648a8ad65e2ec3ac160ab2d76d8d79e92f1fdc62` | 4256 |
| `pnpm-lock.yaml` | `762e018cb7a02d3d3c5c3b5c031229f45b81951308bd57591f76848e02842e3b` | 414912 |

B153 recoverable hashes (`git show 30985b80`):

| path | sha256 |
|---|---|
| `apps/mobile/package.json` | `edbfcdca12677c30d6693ac3f458da717ed50a46a4be78d6149174f9790cd308` |
| `pnpm-workspace.yaml` | `bd44ffef7784beaed6d6fb8da6e76389a17292d980950df639ba8bf2a741da65` |
| `pnpm-lock.yaml` | `6d6c5afa27e996ed1174270e7da18df241529daa52b73aff88e7094177ca5dd4` |
| `apps/admin-web/package.json` | `64e1d7a3770486130fde979cadfe02349bda7cbfe7d8fcf77c5f28d5fc617b31` |
| `apps/learner-web/package.json` | `c5dc4a4911fc2cf8c72c2d0c69f55755a5e240362061651a9206424dd21812d9` |
| `apps/official-site/package.json` | `8ca60badfff0e3b9328edadad8ba2381e3a7135024931d11bf93bf40735d3716` |

Admin/learner/official hashes in this tree still match B153. Root package.json `e2bf8a40…` was already on HEAD `ed6a1e57`.

Lock Vite snapshots present: `6.4.5`, `7.3.7`, `8.2.4`. Remaining `8.2.2` strings are `string-width@8.2.2`. Mobile importer specifier `vite: 8.2.4`. Installed path: `node_modules/.pnpm/vite@8.2.4_…`. Compiler 4.81.

## Inspection (before lock change)

See `INSPECTION.md`. Summary:

- Plugin loads Vite dynamically and prints the resolved version. No runtime `=== '8.2.2'` guard.
- Vite 8.2.4 changelog is the remaining GHSA surface (`safeModulePaths`, wasm `fs.serve`, `transformIndexHtml` query, `launch-editor` 2.14.2).
- pnpm parent selector is documented to rewrite that parent’s peer edge.

## Audit

`pnpm audit --json` after frozen install: **exit 1** (moderate/low remain). High/critical **0**.

| | info | low | moderate | high | critical | advisory objects |
|---|---:|---:|---:|---:|---:|---:|
| B153 / G440 | 0 | 11 | 19 | **1** | 0 | 28 |
| this experiment | 0 | 10 | 15 | **0** | 0 | 22 |

Cleared with Vite 8.2.4: high `GHSA-587h-7wmj-h5pm` / npm `1242661` and the same-installed 8.2.2 siblings (GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg, GHSA-9jrq-w75r-8gcw). `vite_and_high` in `audit-after-summary.json` is `[]`.

Remaining are moderate/low (Nuxt 3 line, glob, minimatch, qs, postcss-selector-parser, @intlify, etc.). High/critical gate was **not** relaxed. Audit exit 1 is **not** a high-gate FAIL.

## Commands and exits

Env: `CI=true`, `NODE_OPTIONS=--max-old-space-size=4096`, turbo `--force --concurrency=1 --ui=stream --cache-dir /tmp/grok-mobile-resume-vite-security-447/turbo-cache`. No Docker, listeners, live business, deployments, or browser. This checkout’s own `node_modules`.

| # | command | exit | real s | notes |
|---|---|---:|---:|---|
| A | `pnpm install --lockfile-only` | **0** | 19.02 | 2 deprecated: glob@10.5.0, unplugin-vue-router@0.19.2; known unmet `@nuxt/cli` → `@nuxt/schema@^4.4.6` found 3.21.11; **no new vite unmet peer** |
| B | `pnpm install --frozen-lockfile` | **0** | 3.27 | lock up to date; +64 −63; ignored build scripts: `core-js-pure` |
| C | `pnpm audit --json` | **1** | 3.55 | high 0 / critical 0 / moderate 15 / low 10 |
| 01 | `pnpm exec turbo run test --force --concurrency=1 --ui=stream --cache-dir $CACHE` | **0** | 1.51 | 1/1 `@englishflow/i18n` **tests 11 pass 11 fail 0** |
| 02 | `pnpm --filter @englishflow/mobile test:b11` | **0** | 0.76 | **tests 14 pass 14 fail 0** |
| 03 | `node ../../scripts/dev/run-node-tests.mjs tests` from `apps/mobile` | **0** | 15.17 | discovered **85** files; **# tests 680 # pass 680 # fail 0**; TAP `1..665` (existing suite numbering) |
| 04 | `pnpm exec turbo run typecheck --force --concurrency=1 --ui=stream --cache-dir $CACHE` | **0** | 11.77 | **7/7** Cached 0: contracts, design-tokens, i18n, performance, api-client, mobile, learner-web |
| 05 | `pnpm exec turbo run build --force --concurrency=1 --ui=stream --cache-dir $CACHE` | **0** | 26.77 | **3/3** Cached 0: official-site, admin-web, learner-web. Mobile has no `build` script; H5/app are separate. |
| 06 | `pnpm --filter @englishflow/mobile build:h5` | **0** | 7.96 | compiler 4.81 vue3; `DONE Build complete.` |
| 07 | `pnpm --filter @englishflow/mobile build:app` | **0** | 10.19 | compiler 4.81 vue3; `DONE Build complete.` Native host missing. |

## New H5 artifact (this experiment)

Root will independently review H5 runtime. Hashes only:

- index.html SHA-256: **`7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8`** (1419 bytes)
- asset root: `apps/mobile/dist/build/h5/assets` (102 files)
- static: `apps/mobile/dist/build/h5/static` (694 files)
- tree fingerprint: `f2ab7809b9d08d9bc8e342314e12c0b16d09628cfab62351390dd21e5f11740e`
- JS entry: `/assets/index-J7t0zLiz.js`
- CSS: `/assets/uni.f315d0bb.css`, `/assets/index-REd9y1Mr.css`
- also preloads `rolldown-runtime.H_PjY6_i.js`

Full dump: `h5-artifact.json`.

H5 warnings that did **not** fail the build (also present on G440 H5): `configLoader: 'native'` ESM-in-CJS on `vite.config.ts`; `[INEFFECTIVE_DYNAMIC_IMPORT]` `src/stores/session.ts`; Sass `@import` in `src/App.vue:150`.

## Native app bundle — compile only, not PASS

- Output: `apps/mobile/dist/build/app`
- `app-service.js` SHA-256 `612c3cd90a9bbea22286269e89a239c24d907c991928cb15251da5914047e332`
- `manifest.json` SHA-256 `dfd7cc33961382ad8c078768a5ce31cc55835247d8ef0312517d3680f0bbf611`
- Log: `DONE Build complete.` then `Run method: open HBuilderX, import dist/build/app run.`
- **No HBuilderX, native host, or device in this job. Missing native host/device is not PASS.**

App compile warnings (bundle still DONE): `Invalid output options amd`; `[EMPTY_IMPORT_META]` in `\0vite/preload-helper.js` under IIFE. G440 did not run `build:app`, so this job does not claim those warnings existed on 8.2.2.

## Known unchanged / out of scope

- Official-site `[error] NO_COLOR` is Node `FORCE_COLOR` vs `NO_COLOR`, not a Nuxt failure.
- Known unmet peer `nuxt@3.21.11 → @nuxt/cli → @nuxt/schema@^4.4.6 found 3.21.11`.
- Deprecated glob@10.5.0, unplugin-vue-router@0.19.2.
- STATUS contract-data CI: not re-run.
- No product API/UI/auth, CI/audit-policy, histories, or Git writes.

## ADR / rollback

Draft: `ADR-PROPOSAL.md` in this directory. Rollback: restore the three B153 hashes above and frozen-install. Do not treat G440’s partial frontend PASS as this experiment’s result.

## Root follow-ups

1. Review `ADR-PROPOSAL.md` before integrating the three files.
2. Independently review this H5 runtime (`index` hash `7622ab9c…`).
3. Native host/device/HBuilderX run remains an open limitation.
4. Keep B153 `30985b80` + freeze recoverable until an accepted ADR lands.
