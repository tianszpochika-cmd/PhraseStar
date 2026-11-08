# G432 partial candidate — isolated verification (G440)

**Verdict: PARTIAL / REVIEWABLE. Not PASS.**

Fail-closed high+critical remains **1**. Required frontend checks actually finished with exit 0. No compatible matched `@dcloudio` family release supports Vite `>=8.2.4` while keeping uni-app Vue3 and the same App-Plus/UTS versions. Settled G432 pins were preserved. This checkout’s own `node_modules` was installed; no other worktree was linked.

- Checkout: `/Users/Admin/.codex/worktrees/mobile-deps-20261108/cloudstudy`
- HEAD (detached): `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`
- Toolchain: Node `v20.19.5`, pnpm `10.19.0`, registry `https://registry.npmjs.org/`
- Git: still only the six restored files; no commit, index, or branch mutation
- Logs: `/tmp/grok-mobile-resume-dependency-build-440/`
- Prior G432 investigation: `/tmp/grok-mobile-resume-dependencies-patch-432/` (read, not replayed)

## Remaining high advisory (preserved)

`pnpm audit --json` after frozen install: **exit 1**.

| | info | low | moderate | high | critical | high+critical | advisory objects |
|---|---:|---:|---:|---:|---:|---:|---:|
| G432 before | 0 | 19 | 44 | 33 | 4 | 37 | 92 |
| G432 after / this install | 0 | 11 | 19 | 1 | 0 | **1** | 28 |

One high object remains:

- npm `1242661` / `GHSA-587h-7wmj-h5pm` / high / module `vite`
- installed `8.2.2` at `apps__mobile>vite`
- vulnerable `>=8.2.0 <=8.2.3`, patched `>=8.2.4`
- GitHub: https://github.com/advisories/GHSA-587h-7wmj-h5pm
- npm version doc: https://registry.npmjs.org/vite/8.2.2
- tarball: https://registry.npmjs.org/vite/-/vite-8.2.2.tgz
- patched version published and **not** installed: https://registry.npmjs.org/vite/8.2.4 (200), tarball https://registry.npmjs.org/vite/-/vite-8.2.4.tgz integrity `sha512-lfauXnrf2x0p+UoA+wXh0dgFWnUjCyG6Js95KBkgaCwUU9k0DAHI4W6Q0WCx+h+5g+Alce1y4Zi2QjjK0UvGBw==`

Same installed `vite@8.2.2` still matches non-blocking advisories, all patched `>=8.2.4`:

- moderate `1242625` GHSA-698v-4r3x-3vcv
- moderate `1242654` GHSA-r825-w8mm-5pxw
- moderate `1242733` GHSA-rq7h-c2jc-7f22
- moderate `1242736` GHSA-vfpm-58rq-9qcg
- low `1242727` GHSA-9jrq-w75r-8gcw

High/critical gate was not turned down.

## `@dcloudio` match query — no compatible release

Live `GET https://registry.npmjs.org/<name>` on 2026-11-08. Packument and exact-version evidence: `dcloudio-registry.json`, `dcloudio-exact-docs.json`, `dcloudio-match-result.json`, `vite-8.2-registry.json`.

Current mobile family (unchanged): `3.0.0-alpha-1000920260909822`

- plugin peer `vite` is exact `8.2.2`
- https://registry.npmjs.org/@dcloudio/vite-plugin-uni/3.0.0-alpha-1000920260909822
- https://registry.npmjs.org/@dcloudio/uni-app/3.0.0-alpha-1000920260909822
- https://registry.npmjs.org/@dcloudio/uni-app-plus/3.0.0-alpha-1000920260909822
- https://registry.npmjs.org/@dcloudio/uni-uts-v1/3.0.0-alpha-1000920260909822
- https://registry.npmjs.org/@dcloudio/uts/3.0.0-alpha-1000920260909822
- tarball: https://registry.npmjs.org/@dcloudio/vite-plugin-uni/-/vite-plugin-uni-3.0.0-alpha-1000920260909822.tgz

10.x/`10009` plugin line has **12** published versions. Vite 8 peers on that line are exact `8.0.13`, `8.1.0`, or `8.2.2`. Latest 10.x is the current `...0909822` (2026-09-09). None publishes `8.2.4`, `^8.2.4`, or any range that includes `8.2.4`.

`vue3` dist-tag is `3.0.0-alpha-5030620261106001` with exact peer `vite: 5.2.8` (different compiler family). URL: https://registry.npmjs.org/@dcloudio/vite-plugin-uni/3.0.0-alpha-5030620261106001 — rejected: would change App-Plus/UTS line identity and would not patch the Vite 8 finding.

Vite `8.2.3` is **404**. Published 8.2.x: `8.2.0`, `8.2.1`, `8.2.2`, `8.2.4`. Latest Vite tag is `8.3.6`. Forcing `8.2.4` against exact peer `8.2.2` was not done.

## Source pins (six-file candidate, unchanged)

SHA-256 after restore and after verification (bytes match G432 worktree):

| path | sha256 | bytes |
|---|---|---:|
| `apps/mobile/package.json` | `edbfcdca12677c30d6693ac3f458da717ed50a46a4be78d6149174f9790cd308` | 1909 |
| `apps/admin-web/package.json` | `64e1d7a3770486130fde979cadfe02349bda7cbfe7d8fcf77c5f28d5fc617b31` | 1120 |
| `apps/learner-web/package.json` | `c5dc4a4911fc2cf8c72c2d0c69f55755a5e240362061651a9206424dd21812d9` | 1065 |
| `apps/official-site/package.json` | `8ca60badfff0e3b9328edadad8ba2381e3a7135024931d11bf93bf40735d3716` | 1087 |
| `pnpm-workspace.yaml` | `bd44ffef7784beaed6d6fb8da6e76389a17292d980950df639ba8bf2a741da65` | 3849 |
| `pnpm-lock.yaml` | `6d6c5afa27e996ed1174270e7da18df241529daa52b73aff88e7094177ca5dd4` | 415180 |

No lock rewrite. Frozen install did not change the lock hash.

## Installed identities (this checkout)

| package | version |
|---|---|
| mobile `vite` | 8.2.2 |
| mobile `vue` | 3.5.45 |
| `@dcloudio/vite-plugin-uni` / `uni-app-plus` / `uni-uts-v1` | `3.0.0-alpha-1000920260909822` |
| admin-web / learner-web `vite` | 6.4.5 |
| official-site `nuxt` | 3.21.11 |
| official-site build stack | Nuxt 3.21.11, Nitro 2.13.4, Vite 7.3.7, Vue 3.5.45 |
| `pinia` | 2.3.1 |
| `element-plus` | 2.14.4 |

Framework majors kept: Nuxt 3, Pinia 2, Vue 3, Element Plus 2. Ports in app scripts unchanged. Existing overrides kept; the removed broad `vite@>=7 <8` selector stays removed.

## Commands and exits

Disk before work: **13.07 GiB** free. Floor 8 GiB. After install **12.46 GiB**. After verification **12.40 GiB**. Did not stop.

Local pnpm store used by this checkout: `.pnpm-store/v10` (gitignored, 555M). `node_modules` 588M, created here, not a symlink.

| # | command | exit | real s | notes |
|---|---|---:|---:|---|
| 1 | registry packument GET `@dcloudio/*` + `vite` | 0 | — | match query; Vite packument sort helper failed once then retried |
| 2 | `pnpm install --frozen-lockfile` | **0** | 22.29 | resolved 958, downloaded 950, added 958; lock up to date |
| 3 | `pnpm audit --json` | **1** | 4.58 | expected: remaining high |
| 4 | `pnpm exec turbo run test --force --concurrency=1 --ui=stream --cache-dir $OUT/turbo-cache` | **0** | 1.54 | Cached 0/1 |
| 5 | `pnpm --filter @englishflow/mobile test:b11` | **0** | 0.77 | |
| 6 | `pnpm exec turbo run typecheck --force --concurrency=1 --ui=stream --cache-dir $OUT/turbo-cache` | **0** | 11.73 | Cached 0/7 |
| 7 | `pnpm exec turbo run build --force --concurrency=1 --ui=stream --cache-dir $OUT/turbo-cache` | **0** | 27.27 | Cached 0/3 |
| 8 | `pnpm --filter @englishflow/mobile build:h5` | **0** | 7.92 | uni compiler 4.81 (vue3); `DONE  Build complete.` |

Env: `CI=true`, `NODE_OPTIONS=--max-old-space-size=4096`, turbo concurrency 1, `--force` (0 cache hits). No Docker, no live business, no deployments, no listeners on 18180–18184.

### Actual test / task counts

- Workspace `turbo test`: 1 task `@englishflow/i18n` — **# tests 11, pass 11, fail 0**
- Mobile `test:b11`: discovered **2** `.test.mjs` files — **# tests 14, pass 14, fail 0**
- Typecheck (7/7): `contracts`, `design-tokens`, `i18n`, `performance`, `api-client`, `mobile`, `learner-web`
- Build (3/3): `official-site` (nuxt), `admin-web` (`vue-tsc && vite build`), `learner-web` (`vue-tsc && vite build`)
- Mobile has no `build` script; H5 is the fourth app build, exit 0
- admin-web has no standalone `typecheck` script; `vue-tsc` ran inside its build and succeeded

## New peer warnings

**None.** Frozen install log: slow tarball warning for `@floating-ui/dom@1.8.0`, and pnpm ignored build scripts for `core-js-pure` (`onlyBuiltDependencies`). No unmet `vite` peer. No `vue` peer mismatch printed.

G432 lockfile-only optional `@nuxt/cli` / `@nuxt/schema@^4.4.6` found `3.21.11` was **not reprinted** on this frozen install.

## Unchanged known findings / out of scope

- Remaining high `vite@8.2.2` / GHSA-587h-7wmj-h5pm: preserved, not waived
- Required frontend checks in this job: **no failures**
- STATUS’s 26 contract-data CI failures: **not re-run** (outside this frontend equivalent)
- Mobile H5 warnings that did **not** fail the build (source/config, Root assignment):
  1. `apps/mobile/vite.config.ts` ESM-in-CJS vs Vite `configLoader: 'native'` future default
  2. `[INEFFECTIVE_DYNAMIC_IMPORT]` `src/stores/session.ts` mixed static/dynamic import
  3. Sass `@import` deprecation in `src/App.vue` line 150
- Official-site log line `[error] (node:…) Warning: The 'NO_COLOR' env is ignored` is the Node FORCE_COLOR warning, not a Nuxt build failure
- Deprecated subdeps from G432 (glob@10.5.0, unplugin-vue-router@0.19.2) remain non-high

## Registry primary URLs used

- https://registry.npmjs.org/vue/-/vue-3.5.45.tgz
- https://registry.npmjs.org/vite/-/vite-6.4.5.tgz
- https://registry.npmjs.org/vite/-/vite-7.3.7.tgz
- https://registry.npmjs.org/vite/-/vite-8.2.2.tgz
- https://registry.npmjs.org/vite/8.2.4
- https://registry.npmjs.org/@dcloudio/vite-plugin-uni/3.0.0-alpha-1000920260909822
- https://registry.npmjs.org/@dcloudio/vite-plugin-uni/3.0.0-alpha-5030620261106001
- https://registry.npmjs.org/@nuxt/devtools/-/devtools-3.4.4.tgz
- https://registry.npmjs.org/@nuxt/vite-builder/-/vite-builder-3.21.11.tgz

## Root follow-ups

1. Wait for a matched `@dcloudio` 10.x family that peers Vite `>=8.2.4` (or a range including it) with the same App-Plus/UTS version, then bump the family + mobile Vite together.
2. Optional source/config: mobile `vite.config.ts` native loader, `session.ts` import shape, Sass `@import`.
3. Do not treat this candidate as fail-closed green while `vite@8.2.2` remains.

Candidate is reviewable on detached `ed6a1e57` with the six restored files, this checkout’s `node_modules`, and the logs above.
