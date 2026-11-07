# High/critical dependency patch plan

Status: PLAN_ONLY. The captured supply-chain job is FAIL, with metadata high 33 and critical 4. No override, lockfile, install, or audit recheck was run. This plan does not claim PASS.

## Gate

`config/p1r-dependency-policy.json` sets `highOrCriticalVulnerability` to `fail`. `scripts/audit/p1r-dependency-audit.mjs` adds the high and critical counts from `pnpm audit --json`. Low (19) and moderate (44) stay in the report and do not block. A payload that cannot be parsed keeps the command status, so a missing registry report still fails closed. Keep that rule.

## Evidence

- Log: `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261107/ci-after-governance/supply-chain-job.log`
- Audit commit in the log: `5d921ed002207440cb0063cc118644ebf94bfbd4`. Report time `2026-11-07T14:20:02.772Z`, mode `runtime`, job `FAIL`, vulnerability `FAIL`, exit `1`, policy echo `fail`.
- Root stated the worktree pin is `61b9ede7` and that the application dependency files match that audit commit. This phase did not run Git.
- Metadata counts: high 33, critical 4, moderate 44, low 19, info 0. `blockingVulnerabilities`: 37. Total dependencies: 1150. Advisory objects in the payload: 92.
- Finding rows in this plan: 37. That is 32 high objects plus the second `@vue/server-renderer` finding, and 4 critical objects. The extra metadata high count is that second finding, not an additional GHSA.
- Lockfile `9.0`. Catalog: Node 20.19.5, pnpm 10.19.0, Java 25, Spring Boot 4.1.1, Spring Cloud 2025.1.3.
- SHA-256 of the working tree compared with the hashes stored in the report:
  - `package.json`: match `e2bf8a40f36d435116326383be7fff376cb5fe126420583affceca76fa2c03c4`
  - `pnpm-lock.yaml`: match `2893c70c02b105ae9fe4aea626a47d44af70dfe9161567def286a300b9465f1c`
  - `pom.xml`: match `d663a16aea33c574e89b3062085adf916f0d7d4d6d14224e73445a825dc4ea0e`
  - `config/toolchain-baseline.json`: differ `3b4d41a16d3278bee54187eee6a3bcb5d8dea5f3aa353ff468be502e71cc0143`
  - `config/p1r-dependency-policy.json`: match `158a07e10e0e01ffb97801eddb79d98ffb1b2c39c0fd6fb148fe518b90d8de60`
- `package.json`, `pnpm-lock.yaml`, `pom.xml`, and `config/p1r-dependency-policy.json` match the audit report. `config/toolchain-baseline.json` does not. That file is outside the dependency lock.
- Maven SBOM in the same report: PASS, exit 0, 207 components. These 37 findings are pnpm advisory entries.
- The job also recorded `ERR_PNPM_MISSING_PACKAGE_INDEX_FILE` for `@napi-rs/lzma-linux-x64-gnu@1.5.1` during Node license inventory. That is a separate error. License policy is unchanged here.
- Existing overrides, kept as they are:
  - `express>path-to-regexp`: `0.1.13`
  - `@dcloudio/uni-nvue-styler>postcss`: `8.5.23`
  - `@dcloudio/uni-cli-shared>adm-zip`: `0.6.1`
  - `@dcloudio/uni-cli-shared>@intlify/core-base`: `9.1.11`
  - `@intlify/message-resolver`: `9.1.11`
  - `svgo`: `>=4.1.0`

## Stack held

Vue stays on 3. Mobile keeps `vue` and the direct `@vue/*` pins at `3.5.41`. The matched `@dcloudio/*` family stays at `3.0.0-alpha-1000920260909822`. Admin-web and learner-web stay on the Vite 6 line, and the Nuxt copy stays on Vite 7. Mobile stays on Vite `8.2.2` because `@dcloudio/vite-plugin-uni` peers `vite` at exactly `8.2.2`. Java 25, Spring Boot 4.1.1, and Spring Cloud 2025.1.3 stay. Nuxt stays at the locked `3.21.11`.

Each floor is the inclusive lower bound of `patchedVersions` that also satisfies every other advisory on that same installed version. Where two majors of one module are installed, the selectors are version-bounded so a 2.x copy is not replaced by a 5.x release. This phase did not query the npm registry, so the floor is the advisory bound already in the log, not a newly resolved tarball. Package identity for each installed version is the lockfile `resolution.integrity`. The advisory link is the `url` in the payload.

Scope follows the workspace manifest edge. `dependencies` is runtime. `devDependencies` is build. Several official-site rows are runtime because `nuxt` is a production dependency, while the vulnerable package sits under `@nuxt/devtools` or `@nuxt/cli`. Scope does not remove a finding from the gate.

## Advisory table

| # | Sev | GHSA | Module | Installed | Patched range | Floor | Scope | Lock parents | Path |
|---|-----|------|--------|-----------|---------------|-------|-------|--------------|------|
| 1 | high | [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) | `adm-zip` | `0.5.16` | `>=0.6.0` | `0.6.0` | build | @dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-uts-v1>adm-zip |
| 2 | high | [GHSA-7q85-xj36-vmfc](https://github.com/advisories/GHSA-7q85-xj36-vmfc) | `adm-zip` | `0.5.16` | `>=0.6.1` | `0.6.1` | build | @dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-uts-v1>adm-zip |
| 3 | high | [GHSA-rcw4-f5rp-g42v](https://github.com/advisories/GHSA-rcw4-f5rp-g42v) | `adm-zip` | `0.5.16` | `>=0.6.1` | `0.6.1` | build | @dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-uts-v1>adm-zip |
| 4 | high | [GHSA-j5f4-cc29-5x44](https://github.com/advisories/GHSA-j5f4-cc29-5x44) | `adm-zip` | `0.5.16` | `>=0.6.1` | `0.6.1` | build | @dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-uts-v1>adm-zip |
| 5 | high | [GHSA-8238-w5pm-2374](https://github.com/advisories/GHSA-8238-w5pm-2374) | `adm-zip` | `0.5.16` | `>=0.6.1` | `0.6.1` | build | @dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-uts-v1>adm-zip |
| 6 | high | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `brace-expansion` | `2.1.4` | `>=2.1.6` | `2.1.6` | build | minimatch@5.1.9<br>minimatch@9.0.9 | apps__admin-web>vue-tsc>@vue/language-core>minimatch>brace-expansion |
| 7 | high | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `brace-expansion` | `5.0.9` | `>=5.0.11` | `5.0.11` | runtime | minimatch@10.2.6 | apps__official-site>nuxt>@nuxt/nitro-server>nitropack>@vercel/nft>glob>minimatch>brace-expansion |
| 8 | high | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `brace-expansion` | `2.1.4` | `>=2.1.5` | `2.1.5` | build | minimatch@5.1.9<br>minimatch@9.0.9 | apps__admin-web>vue-tsc>@vue/language-core>minimatch>brace-expansion |
| 9 | high | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `brace-expansion` | `5.0.9` | `>=5.0.10` | `5.0.10` | runtime | minimatch@10.2.6 | apps__official-site>nuxt>@nuxt/nitro-server>nitropack>@vercel/nft>glob>minimatch>brace-expansion |
| 10 | high | [GHSA-j22f-vq7h-c4qm](https://github.com/advisories/GHSA-j22f-vq7h-c4qm) | `devalue` | `5.9.0` | `>=5.9.3` | `5.9.3` | runtime | @nuxt/nitro-server@3.21.11<br>nuxt@3.21.11 | apps__official-site>nuxt>devalue |
| 11 | high | [GHSA-mcm9-63f2-9j32](https://github.com/advisories/GHSA-mcm9-63f2-9j32) | `devalue` | `5.9.0` | `>=5.9.3` | `5.9.3` | runtime | @nuxt/nitro-server@3.21.11<br>nuxt@3.21.11 | apps__official-site>nuxt>devalue |
| 12 | high | [GHSA-x5rw-q4pp-hg5g](https://github.com/advisories/GHSA-x5rw-q4pp-hg5g) | `devalue` | `5.9.0` | `>=5.9.3` | `5.9.3` | runtime | @nuxt/nitro-server@3.21.11<br>nuxt@3.21.11 | apps__official-site>nuxt>devalue |
| 13 | high | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge` | `1.4.0` | `<0.0.0` | `no patched release` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 14 | critical | [GHSA-v5rq-49vh-5v5c](https://github.com/advisories/GHSA-v5rq-49vh-5v5c) | `@simple-git/argv-parser` | `1.1.1` | `>=2.0.1` | `2.0.1` | runtime | simple-git@3.36.0 | apps__official-site>nuxt>@nuxt/devtools>simple-git>@simple-git/argv-parser |
| 15 | critical | [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh) | `simple-git` | `3.36.0` | `>=4.0.1` | `4.0.1` | runtime | @nuxt/devtools@3.4.1 | apps__official-site>nuxt>@nuxt/devtools>simple-git |
| 16 | high | [GHSA-g4wm-2vf7-vfgr](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr) | `simple-git` | `3.36.0` | `>=4.0.0` | `4.0.0` | runtime | @nuxt/devtools@3.4.1 | apps__official-site>nuxt>@nuxt/devtools>simple-git |
| 17 | high | [GHSA-jp82-f5mq-hwhp](https://github.com/advisories/GHSA-jp82-f5mq-hwhp) | `seroval` | `1.6.2` | `>=1.6.3` | `1.6.3` | runtime | @nuxt/vite-builder@3.21.11 | apps__official-site>nuxt>@nuxt/vite-builder>seroval |
| 18 | high | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `source-map-js` | `1.2.1` | `>=1.2.2` | `1.2.2` | build | @dcloudio/uni-app-uts@3.0.0-alpha-1000920260909822<br>@dcloudio/uni-cli-shared@3.0.0-alpha-1000920260909822<br>@dcloudio/uni-uts-v1@3.0.0-alpha-1000920260909822<br>@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822<br>@vue/compiler-core@3.4.21<br>@vue/compiler-core@3.5.41<br>@vue/compiler-sfc@3.4.21<br>@vue/compiler-sfc@3.5.41<br>css-tree@2.2.1<br>css-tree@3.2.1<br>magicast@0.5.4<br>postcss@8.5.23<br>postcss@8.5.26<br>sass@1.103.0<br>vite-plugin-vue-tracer@1.5.0 | apps__admin-web>vite>postcss>source-map-js |
| 19 | critical | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | `proxy-addr` | `2.0.7` | `>=2.0.8` | `2.0.8` | build | express@4.20.0 | apps__mobile>@dcloudio/vite-plugin-uni>express>proxy-addr |
| 20 | high | [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6) | `@vue/server-renderer` | `3.5.41` | `>=3.5.42` | `3.5.42` | runtime | vue@3.5.41 | apps__admin-web>vue>@vue/server-renderer |
| 21 | high | [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6) | `@vue/server-renderer` | `3.4.21` | `>=3.5.42` | `3.5.42` | build | @dcloudio/uni-cli-shared@3.0.0-alpha-1000920260909822<br>@dcloudio/uni-h5-vite@3.0.0-alpha-1000920260909822<br>@dcloudio/uni-h5-vue@3.0.0-alpha-1000920260909822<br>@dcloudio/uni-h5@3.0.0-alpha-1000920260909822 | apps__mobile>@dcloudio/uni-app>@dcloudio/uni-cloud>@dcloudio/uni-cli-shared>@vue/server-renderer |
| 22 | critical | [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) | `shell-quote` | `1.10.0` | `>=1.11.0` | `1.11.0` | runtime | launch-editor@2.14.1 | apps__official-site>nuxt>@nuxt/devtools>launch-editor>shell-quote |
| 23 | high | [GHSA-r9w8-h9r3-54w4](https://github.com/advisories/GHSA-r9w8-h9r3-54w4) | `devalue` | `5.9.0` | `>=5.9.3` | `5.9.3` | runtime | @nuxt/nitro-server@3.21.11<br>nuxt@3.21.11 | apps__official-site>nuxt>devalue |
| 24 | high | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `vite` | `6.4.3` | `>=6.4.4` | `6.4.4` | build | @vitejs/plugin-vue@5.2.4 | apps__admin-web>vite |
| 25 | high | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `vite` | `7.3.6` | `>=7.3.7` | `7.3.7` | runtime | @nuxt/devtools-kit@3.4.1<br>@nuxt/devtools@3.4.1<br>@nuxt/vite-builder@3.21.11<br>@vitejs/plugin-vue-jsx@5.1.6<br>@vitejs/plugin-vue@6.0.8<br>unplugin@3.3.0<br>vite-dev-rpc@2.0.0<br>vite-hot-client@2.2.0<br>vite-node@5.3.0<br>vite-plugin-checker@0.14.5<br>vite-plugin-inspect@11.4.1<br>vite-plugin-vue-tracer@1.5.0 | apps__official-site>nuxt>@nuxt/devtools>vite |
| 26 | high | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `vite` | `8.2.2` | `>=8.2.4` | `8.2.4` | build | @dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822<br>@vitejs/plugin-basic-ssl@2.3.0<br>@vitejs/plugin-legacy@8.1.0<br>@vitejs/plugin-vue-jsx@5.1.6<br>@vitejs/plugin-vue@6.0.7 | apps__mobile>vite |
| 27 | high | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `launch-editor` | `2.14.1` | `>=2.14.2` | `2.14.2` | runtime | @nuxt/devtools@3.4.1 | apps__official-site>nuxt>@nuxt/devtools>launch-editor |
| 28 | high | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) | `body-parser` | `1.20.3` | `>=1.20.9` | `1.20.9` | build | express@4.20.0 | apps__mobile>@dcloudio/vite-plugin-uni>express>body-parser |
| 29 | high | [GHSA-97r2-qh9m-474h](https://github.com/advisories/GHSA-97r2-qh9m-474h) | `seroval` | `1.6.2` | `>=1.6.8` | `1.6.8` | runtime | @nuxt/vite-builder@3.21.11 | apps__official-site>nuxt>@nuxt/vite-builder>seroval |
| 30 | high | [GHSA-wp97-x4hv-qvhp](https://github.com/advisories/GHSA-wp97-x4hv-qvhp) | `seroval` | `1.6.2` | `>=1.6.8` | `1.6.8` | runtime | @nuxt/vite-builder@3.21.11 | apps__official-site>nuxt>@nuxt/vite-builder>seroval |
| 31 | high | [GHSA-7rv5-mrxv-xcr9](https://github.com/advisories/GHSA-7rv5-mrxv-xcr9) | `seroval` | `1.6.2` | `>=1.6.8` | `1.6.8` | runtime | @nuxt/vite-builder@3.21.11 | apps__official-site>nuxt>@nuxt/vite-builder>seroval |
| 32 | high | [GHSA-7wch-p9px-956x](https://github.com/advisories/GHSA-7wch-p9px-956x) | `node-forge` | `1.4.0` | `>=1.4.1` | `1.4.1` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 33 | high | [GHSA-jc66-7q78-782g](https://github.com/advisories/GHSA-jc66-7q78-782g) | `node-forge` | `1.4.0` | `>=1.4.1` | `1.4.1` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 34 | high | [GHSA-8hrf-8g6f-7xwp](https://github.com/advisories/GHSA-8hrf-8g6f-7xwp) | `node-forge` | `1.4.0` | `>=1.4.1` | `1.4.1` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 35 | high | [GHSA-hqq3-7jhf-c5jx](https://github.com/advisories/GHSA-hqq3-7jhf-c5jx) | `node-forge` | `1.4.0` | `>=1.4.1` | `1.4.1` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 36 | high | [GHSA-5x38-2vff-x55p](https://github.com/advisories/GHSA-5x38-2vff-x55p) | `node-forge` | `1.4.0` | `>=1.4.1` | `1.4.1` | runtime | listhen@1.10.1 | apps__official-site>nuxt>@nuxt/cli>listhen>node-forge |
| 37 | high | [GHSA-858h-whjf-mvg5](https://github.com/advisories/GHSA-858h-whjf-mvg5) | `simple-git` | `3.36.0` | `>=4.0.0` | `4.0.0` | runtime | @nuxt/devtools@3.4.1 | apps__official-site>nuxt>@nuxt/devtools>simple-git |

Titles, vulnerable ranges, workspace specifiers, exposure notes, and integrity strings are in `PLAN.json`.

## Proposed fixes

Nothing below is applied. On a later integration, add the override lines and the two Vite 6 specifiers, leave the six current overrides, and leave the mobile Vite pin at `8.2.2`. Then refresh the lock and rerun the runtime dependency audit. The job remains fail-closed until the blocking count is zero.

Vite peers recorded in the lock:
- `@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822` peer `vite`: `8.2.2`
- `@vitejs/plugin-vue@5.2.4` peer `vite`: `^5.0.0 || ^6.0.0`
- `@vitejs/plugin-vue@6.0.7` peer `vite`: `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`
- `@vitejs/plugin-vue@6.0.8` peer `vite`: `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`

### A01 `adm-zip` 0.5.16 -> `0.6.1`

- Decision: `propose-parent-override`
- Change: `'@dcloudio/uni-uts-v1>adm-zip': 0.6.1`
- Scope: `build`
- Advisories: GHSA-xcpc-8h2w-3j85, GHSA-7q85-xj36-vmfc, GHSA-rcw4-f5rp-g42v, GHSA-j5f4-cc29-5x44, GHSA-8238-w5pm-2374 (rows 1, 2, 3, 4, 5)
- Floor choice: GHSA-xcpc-8h2w-3j85 is fixed at >=0.6.0. The other four adm-zip advisories are fixed only at >=0.6.1, and GHSA-rcw4-f5rp-g42v, GHSA-j5f4-cc29-5x44, and GHSA-8238-w5pm-2374 still include 0.6.0.
- Stack: uni-app family pin stays 3.0.0-alpha-1000920260909822. This adds the missing parent next to the existing @dcloudio/uni-cli-shared>adm-zip override, which is already 0.6.1.
- Compatibility: 0.x minor move from 0.5.16 to 0.6.1. The same 0.6.1 pin is already used on the uni-cli-shared edge.

### A02 `brace-expansion` 2.1.4 -> `2.1.6`

- Decision: `propose-range-override`
- Change: `'brace-expansion@>=2.0.0 <3.0.0': 2.1.6`
- Scope: `build`
- Advisories: GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p (rows 6, 8)
- Floor choice: 2.1.6 satisfies both >=2.1.5 (GHSA-6j4f-fj2g-mc7p) and >=2.1.6 (GHSA-qhr7-859c-m2p7). 2.1.5 leaves the second advisory open.
- Stack: Leaves Vue, uni-app, Vite, and Java unchanged. Lock parents of 2.1.4 are minimatch@5.1.9 and minimatch@9.0.9.
- Compatibility: Same 2.1 line. The captured path is apps/admin-web > vue-tsc. apps/learner-web also locks vue-tsc@2.2.12; this range covers that copy without a second key.

### A03 `brace-expansion` 5.0.9 -> `5.0.11`

- Decision: `propose-range-override`
- Change: `'brace-expansion@>=5.0.0 <6.0.0': 5.0.11`
- Scope: `runtime`
- Advisories: GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p (rows 7, 9)
- Floor choice: 5.0.11 satisfies both >=5.0.10 and >=5.0.11. A single minimatch>brace-expansion pin cannot serve the 2.x and 5.x lines together.
- Stack: Lock parent is minimatch@10.2.6, reached through nuxt > @nuxt/nitro-server > nitropack > @vercel/nft > glob. Nuxt stays at the locked 3.21.11.
- Compatibility: Same 5.0 line.

### A04 `devalue` 5.9.0 -> `5.9.3`

- Decision: `propose-version-override`
- Change: `'devalue@5.9.0': 5.9.3`
- Scope: `runtime`
- Advisories: GHSA-j22f-vq7h-c4qm, GHSA-mcm9-63f2-9j32, GHSA-x5rw-q4pp-hg5g, GHSA-r9w8-h9r3-54w4 (rows 10, 11, 12, 23)
- Floor choice: All four devalue advisories share patchedVersions >=5.9.3.
- Stack: Lock parents are nuxt@3.21.11 and @nuxt/nitro-server@3.21.11. The Nuxt version stays.
- Compatibility: Same 5.9 line.

### A05 `node-forge` 1.4.0 -> `1.4.1`

- Decision: `propose-parent-override`
- Change: `'listhen>node-forge': 1.4.1`
- Scope: `runtime`
- Advisories: GHSA-7wch-p9px-956x, GHSA-jc66-7q78-782g, GHSA-8hrf-8g6f-7xwp, GHSA-hqq3-7jhf-c5jx, GHSA-5x38-2vff-x55p (rows 32, 33, 34, 35, 36)
- Floor choice: Five node-forge advisories are fixed at >=1.4.1. This does not clear GHSA-86w9-cpqp-85rv.
- Stack: Only lock parent is listhen@1.10.1, under nuxt > @nuxt/cli. Nuxt stays 3.21.11.
- Compatibility: Same 1.4 line.

### A06 `node-forge` 1.4.0 -> `None`

- Decision: `no-upstream-fix`
- Change: `None`
- Scope: `runtime`
- Advisories: GHSA-86w9-cpqp-85rv (rows 13)
- Floor choice: patchedVersions is <0.0.0, the advisory sentinel for no patched release.
- Stack: Same listhen@1.10.1 edge as A05. No Vue, uni-app, or Java change removes this object.
- Compatibility: The high/critical gate stays fail while this object is present. Do not waive it and do not lower the threshold.

### A07 `simple-git` 3.36.0 -> `4.0.1`

- Decision: `propose-major-with-parent-review`
- Change: `'@nuxt/devtools>simple-git': 4.0.1`
- Scope: `runtime`
- Advisories: GHSA-x6jw-m9v5-85vh, GHSA-g4wm-2vf7-vfgr, GHSA-858h-whjf-mvg5 (rows 15, 16, 37)
- Floor choice: GHSA-g4wm-2vf7-vfgr and GHSA-858h-whjf-mvg5 fix at >=4.0.0. GHSA-x6jw-m9v5-85vh fixes only at >=4.0.1.
- Stack: Lock parent is @nuxt/devtools@3.4.1. Devtools and Nuxt versions stay. This is outside the Vue 3, uni-app, and Java pins.
- Compatibility: Major move from 3.36.0 to 4.0.1. The advisory gives no 3.x floor. The parent's declared range is not in the lock snapshot. Apply it in the same lock refresh as A08.

### A08 `@simple-git/argv-parser` 1.1.1 -> `2.0.1`

- Decision: `propose-major-with-parent-review`
- Change: `'simple-git>@simple-git/argv-parser': 2.0.1`
- Scope: `runtime`
- Advisories: GHSA-v5rq-49vh-5v5c (rows 14)
- Floor choice: The only patched range is >=2.0.1.
- Stack: Lock parent is simple-git@3.36.0, itself under @nuxt/devtools@3.4.1.
- Compatibility: Major move from 1.1.1 to 2.0.1. Apply together with simple-git 4.0.1 so the nested parser and its parent move in one resolution.

### A09 `seroval` 1.6.2 -> `1.6.8`

- Decision: `propose-parent-override`
- Change: `'@nuxt/vite-builder>seroval': 1.6.8`
- Scope: `runtime`
- Advisories: GHSA-jp82-f5mq-hwhp, GHSA-97r2-qh9m-474h, GHSA-wp97-x4hv-qvhp, GHSA-7rv5-mrxv-xcr9 (rows 17, 29, 30, 31)
- Floor choice: GHSA-jp82-f5mq-hwhp is fixed at >=1.6.3. GHSA-97r2-qh9m-474h, GHSA-wp97-x4hv-qvhp, and GHSA-7rv5-mrxv-xcr9 are fixed only at >=1.6.8.
- Stack: Only lock parent is @nuxt/vite-builder@3.21.11. Nuxt stays 3.21.11.
- Compatibility: Same 1.6 line.

### A10 `source-map-js` 1.2.1 -> `1.2.2`

- Decision: `propose-module-override`
- Change: `'source-map-js': 1.2.2`
- Scope: `build`
- Advisories: GHSA-68fv-2mgg-jv7q (rows 18)
- Floor choice: The only patched range is >=1.2.2.
- Stack: The captured path is apps/admin-web > vite > postcss. The lock also resolves 1.2.1 under 15 parents, including postcss 8.5.23 and 8.5.26, both Vue 3.4.21 and 3.5.41 compilers, sass, and four @dcloudio packages. One module pin clears every locked copy. Vue and uni-app version pins stay.
- Compatibility: Same 1.2 line. A postcss-only selector would leave the other locked parents on 1.2.1.

### A11 `proxy-addr` 2.0.7 -> `2.0.8`

- Decision: `propose-parent-override`
- Change: `'express>proxy-addr': 2.0.8`
- Scope: `build`
- Advisories: GHSA-jqcg-44mw-7w3h (rows 19)
- Floor choice: The only patched range is >=2.0.8.
- Stack: Lock parent is express@4.20.0 under @dcloudio/vite-plugin-uni. The uni-app family pin stays. This matches the existing express>path-to-regexp override style.
- Compatibility: Same 2.0 line.

### A12 `body-parser` 1.20.3 -> `1.20.9`

- Decision: `propose-parent-override`
- Change: `'express>body-parser': 1.20.9`
- Scope: `build`
- Advisories: GHSA-27r3-jxmh-p828 (rows 28)
- Floor choice: The only patched range is >=1.20.9.
- Stack: Same express@4.20.0 parent as proxy-addr. No Express major move.
- Compatibility: Same 1.20 line.

### A13 `@vue/server-renderer` 3.5.41 -> `3.5.42`

- Decision: `propose-parent-override`
- Change: `'vue>@vue/server-renderer': 3.5.42`
- Scope: `runtime`
- Advisories: GHSA-g2v6-rqmx-r4w6 (rows 20)
- Floor choice: Vulnerable range is <3.5.42. There is no older patched release in the advisory.
- Stack: Lock parent is vue@3.5.41, the version already resolved for admin-web, learner-web, and mobile. The vue specifier stays 3.5.41 on mobile and ^3.4.0 on the Vue web apps.
- Compatibility: Vue 3 patch, one release above the locked 3.5.41 renderer. The captured path is apps/admin-web > vue.

### A14 `@vue/server-renderer` 3.4.21 -> `3.5.42`

- Decision: `propose-version-override-with-uni-build-check`
- Change: `'@vue/server-renderer@3.4.21': 3.5.42`
- Scope: `build`
- Advisories: GHSA-g2v6-rqmx-r4w6 (rows 21)
- Floor choice: The advisory's patched range starts at 3.5.42, so the 3.4 line has no patched release.
- Stack: The captured path is @dcloudio/uni-cli-shared. The lock also resolves 3.4.21 from @dcloudio/uni-h5, @dcloudio/uni-h5-vite, and @dcloudio/uni-h5-vue. Those packages stay on alpha 3.0.0-alpha-1000920260909822. @dcloudio/uni-shared still resolves @vue/shared@3.4.21.
- Compatibility: Stays on Vue 3 and does not change the uni-app family pin. It does move this renderer copy from the 3.4 line to 3.5.42. Root should build the mobile H5/App targets before accepting it. Skipping it leaves a high finding in place.

### A15 `shell-quote` 1.10.0 -> `1.11.0`

- Decision: `propose-parent-override`
- Change: `'launch-editor>shell-quote': 1.11.0`
- Scope: `runtime`
- Advisories: GHSA-pqg4-j6r4-53mv (rows 22)
- Floor choice: The only patched range is >=1.11.0.
- Stack: Lock parent is launch-editor@2.14.1 under @nuxt/devtools@3.4.1.
- Compatibility: Same 1.x line. Apply with the launch-editor pin in A16.

### A16 `launch-editor` 2.14.1 -> `2.14.2`

- Decision: `propose-parent-override`
- Change: `'@nuxt/devtools>launch-editor': 2.14.2`
- Scope: `runtime`
- Advisories: GHSA-587h-7wmj-h5pm (rows 27)
- Floor choice: GHSA-587h-7wmj-h5pm fixes launch-editor at >=2.14.2. The Vite copies of this advisory are separate rows.
- Stack: Lock parent is @nuxt/devtools@3.4.1. Devtools stays.
- Compatibility: Same 2.14 line.

### A17 `vite` 6.4.3 -> `6.4.4`

- Decision: `propose-direct-pin`
- Change: `apps/admin-web/package.json and apps/learner-web/package.json: vite 6.4.3 -> 6.4.4`
- Scope: `build`
- Advisories: GHSA-587h-7wmj-h5pm (rows 24)
- Floor choice: The Vite 6 range of GHSA-587h-7wmj-h5pm is fixed at >=6.4.4.
- Stack: Stays on Vite 6. Do not use one workspace vite override; that would also move the Vite 7 and Vite 8 copies.
- Compatibility: The captured path lists apps/admin-web only. The lock importers for both admin-web and learner-web specify vite 6.4.3 and resolve 6.4.3. `@vitejs/plugin-vue@5.2.4` peers `vite` at `^5.0.0 || ^6.0.0`, which accepts 6.4.4.

### A18 `vite` 7.3.6 -> `7.3.7`

- Decision: `propose-range-override`
- Change: `'vite@>=7.0.0 <8.0.0': 7.3.7`
- Scope: `runtime`
- Advisories: GHSA-587h-7wmj-h5pm (rows 25)
- Floor choice: The Vite 7 range is fixed at >=7.3.7. The upper bound keeps Vite 6 and Vite 8 on their own actions.
- Stack: Twelve lock parents, all under the Nuxt 3.21 / @nuxt/devtools 3.4.1 graph, including @nuxt/vite-builder and @vitejs/plugin-vue@6.0.8. Nuxt and devtools versions stay.
- Compatibility: Same Vite 7 line. `@vitejs/plugin-vue@6.0.8` peers `vite` at `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`, which accepts 7.3.7. The only exact `vite` peer in the lock is the uni-app plugin on 8.2.2, so this selector does not move mobile.

### A19 `vite` 8.2.2 -> `8.2.4`

- Decision: `blocked-exact-peer`
- Change: none in this compatible plan
- Scope: `build`
- Advisories: GHSA-587h-7wmj-h5pm (rows 26)
- Floor choice: The Vite 8 range is fixed at >=8.2.4. 8.2.3 is still inside the vulnerable range <=8.2.3.
- Stack: `@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822` peers `vite` at exactly `8.2.2`. `@vitejs/plugin-vue@6.0.7`, `@vitejs/plugin-vue-jsx@5.1.6`, `@vitejs/plugin-legacy@8.1.0`, and `@vitejs/plugin-basic-ssl@2.3.0` accept a Vite 8 range, so the blocking peer is the uni plugin. The uni-app family pin stays.
- Compatibility: No published floor in the advisory also satisfies that exact peer. Do not bump `apps/mobile` Vite inside this plan, and do not upgrade the DCloud family here. The high finding stays, and the gate stays fail.

## Gate result if the compatible pins resolve

Thirty-five findings have a floor that can move without leaving Vue 3, the uni-app alpha, or an exact peer. Two highs remain. `GHSA-86w9-cpqp-85rv` on `node-forge@1.4.0` has `patchedVersions` `<0.0.0`. `GHSA-587h-7wmj-h5pm` on `vite@8.2.2` has a floor of 8.2.4 that the uni-app plugin peer does not accept. The high/critical gate stays fail. Those two findings are not waived. `@vue/server-renderer@3.4.21` (A14) is still a Vue 3 floor, with a mobile build check because it leaves the 3.4 line the uni packages resolved.

## Not run

No install, no lock edit, no `pnpm audit`, no registry or config change, no server, and no source edit. A later `node scripts/audit/p1r-dependency-audit.mjs --runtime` is the check that can change this FAIL. It was not run.
