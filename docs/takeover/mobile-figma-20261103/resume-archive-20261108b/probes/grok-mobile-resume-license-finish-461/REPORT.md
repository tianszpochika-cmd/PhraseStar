# G461 license inventory finish

STATUS: `LOCAL_FALLBACK_READY` / Darwin static audit `REVIEW` exit 0 / Linux store recovery `NOT_RUN` / remote CI `NOT_RUN`.

This continues G453 (`max_turn_requests` partial, no REPORT). G453 receipts under `/tmp/grok-mobile-resume-license-inventory-453` were not rewritten. G459/G457 artifacts were not opened or changed. No git commit, push, install, module-link change, listener, Docker, JVM, browser, or networked `pnpm audit`.

## Decision

The Linux Node 20 + pnpm 10.19 license failure is still a tool bug after the G447 install. `pnpm licenses list` asks for a store index for every lock os/cpu match and does not apply `engines`. Install skips optional `@napi-rs/lzma-linux-x64-gnu@1.5.1` because its engines are `^22.20 || ^24.12 || >=25`. On Linux x64 that package matches os/cpu, so licenses exits with `ERR_PNPM_MISSING_PACKAGE_INDEX_FILE`. On this Darwin arm64 machine the same package fails the lock `os: [linux]` check before the store lookup, so `pnpm licenses list --json` exits 0. The lock still contains the package (`pnpm-lock.yaml` packages line 1577, snapshot line 7463, `optional: true`, no dependencies). Removing it would be a lock change, which was not allowed.

The checker change is limited to `scripts/audit/p1r-dependency-audit.mjs` and the extracted helper `scripts/audit/p1r-node-license-inventory.mjs` plus its test. Policy, allowlist, manifests, lockfile, and installed modules were not edited.

## What the fallback does

On `ERR_PNPM_MISSING_PACKAGE_INDEX_FILE` only, the audit rebuilds license groups from installed `package.json` manifests for every package the license scanner would request (importer prod/dev/optional edges, os/cpu/libc gate, engines not used as a walk filter). A package may be omitted only when it is optional, not installed, and the lock proves one of:

- lock `os` / `cpu` / `libc` does not match the current platform
- lock os/cpu match, and the package id names that same os and cpu plus a different libc (`gnu` vs `musl`)
- `engines.node` or `engines.pnpm` is a range `semver` can prove does not satisfy the current Node or the catalog pnpm pin

Unknown libc does not prove a musl absence. A non-optional engine mismatch is not an absence. A missing current-platform package, including `@rollup/rollup-linux-x64-gnu@4.62.4` and `@esbuild/linux-x64`, stays a failure. The exclusive subtree of an uninstalled proven-absent optional is not demanded; the same package reached by another required edge still fails if its manifest is missing. An installed copy is inventoried even when its id would otherwise be foreign, so an installed `AGPL-3.0` stays in the groups. Empty recovery fails. Any other command failure stays the original failure. License text comes from the installed manifest or a local LICENSE file using pnpm's license-name list. Missing or unrecognized text stays `Unknown`. No registry value is invented.

Denied licenses remain errors (`AGPL-1.0`, `AGPL-3.0`, `SSPL-1.0`). Unknown licenses remain the existing review warning. The high/critical vulnerability gate is unchanged and runs only with `--runtime`. This run did not pass `--runtime` or `--emit`.

G461 review tightened two points in the G453 helper: package-id omission is libc-only after lock os/cpu match, and children of an uninstalled proven-absent optional are not required. The audit diagnostic is the combined stderr, stdout, and spawn error, so a warning on one stream cannot hide the missing-index JSON.

## Actual exits

| Command | Exit | Result |
|---|---|---|
| `node --test scripts/audit/p1r-node-license-inventory.test.mjs` | 0 | 10 pass, 0 fail, 0 skipped, duration_ms 995.244375. Stderr is only the `NO_COLOR`/`FORCE_COLOR` warning. Output: `inventory-test.out`, `inventory-test.err`. |
| `node scripts/audit/p1r-dependency-audit.mjs` (no `--runtime`, no `--emit`), second invocation | 0 | `result` REVIEW, `mode` static, `errors` [], license groups 13, denied [], unknown `Unknown`, vulnerability `NOT_RUN`, Maven SBOM `NOT_RUN`. `generatedAt` 2026-11-08T14:37:32.591Z. `sourceCommit` `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`. Stderr is only the same color warning. |
| First audit wrapper | shell 1 | Node had already written a 10317-byte REVIEW JSON. The wrapper then assigned zsh's read-only `status`, so it did not record an exit file. The re-run above is the recorded exit. |
| `pnpm audit` | NOT_RUN | Would use the network. High/critical numbers were not re-fetched. |
| Maven CycloneDX / `--runtime` | NOT_RUN | Would start a JVM. |
| Linux pnpm licenses against a Linux store | NOT_RUN | This host is Darwin arm64, Node v20.19.5, pnpm 10.19.0. |
| Remote CI `pnpm p1r:supply-chain:check` | NOT_RUN | No full-CI claim. |

Live Darwin audit checks: 82, failed 0. Provenance check absent, because licenses exited 0 and the recovery branch did not run. Inventory in that JSON: node locked components 1149, Maven direct components 26. Lock hash inside the JSON matches `762e018cb7a02d3d3c5c3b5c031229f45b81951308bd57591f76848e02842e3b`.

Offline tests cover: unclassified pnpm failure, foreign optional with installed AGPL and Unknown kept, missing current-platform native, optional engine mismatch and the same package required on Node 22.20.0, non-optional engine mismatch, empty recovery, musl id foreign on glibc while the gnu build is required, installed musl AGPL kept, transitive optional subtree omitted, transitive required gap failed, direct required edge to that same child failed, unknown libc does not excuse musl, `@esbuild/linux-x64` stays required, and a real Darwin install recovery when the diagnostic names only the napi package (more than 900 names, `@alloc/quick-lru@5.2.0` MIT, `@dcloudio/uts` Unknown, no denied group).

## Source manifest

Pre-edit snapshot: `preexisting/hashes.txt` (taken before the G461 review edits). Final: `source-manifest.txt`. `exact.diff` is 958 lines: G453 baseline audit script versus the current audit script, then the two new files against `/dev/null`.

Final SHA-256 and size:

- `scripts/audit/p1r-dependency-audit.mjs` `3ce778f64a719eecddae86538e50722db92d02c2f4ddf4e8627d2e3f887ae29b` 19532
- `scripts/audit/p1r-node-license-inventory.mjs` `9b7ac1e6a9902452ae54c49b0084fe73cd39f175adafdf3e1ad888ce26b568c6` 18892
- `scripts/audit/p1r-node-license-inventory.test.mjs` `42b8abd59e135ca6646987182e9ac7456118ab1303eb7f01f0c2a9cd97c9f5ab` 19062

Unchanged from the pre-edit snapshot:

- `config/p1r-dependency-policy.json` `158a07e10e0e01ffb97801eddb79d98ffb1b2c39c0fd6fb148fe518b90d8de60` 1240
- `package.json` `e2bf8a40f36d435116326383be7fff376cb5fe126420583affceca76fa2c03c4` 12584
- `pnpm-lock.yaml` `762e018cb7a02d3d3c5c3b5c031229f45b81951308bd57591f76848e02842e3b` 414912
- `pnpm-workspace.yaml` `e0dec117f697e0c96824fc5b648a8ad65e2ec3ac160ab2d76d8d79e92f1fdc62` 4256
- `apps/mobile/package.json` `e08004d99a0486f6cb56fa2cca5f60f4e22455cc6fc5e0dff09b9e1fbfcad298` 1909
- `apps/admin-web/package.json` `64e1d7a3770486130fde979cadfe02349bda7cbfe7d8fcf77c5f28d5fc617b31` 1120
- `apps/learner-web/package.json` `c5dc4a4911fc2cf8c72c2d0c69f55755a5e240362061651a9206424dd21812d9` 1065
- `apps/official-site/package.json` `8ca60badfff0e3b9328edadad8ba2381e3a7135024931d11bf93bf40735d3716` 1087

`git status --short` still shows the pre-existing G447 manifest/lock edits plus these three audit files. No evidence directory was written in the repo.

## Remaining risks

- A real Linux Node 20 store was not used. Recovery on that host is argued from pnpm 10.19.0 `lockfileToLicenseNode` (os/cpu/libc only, then `getPkgInfo`) and from the lock plus offline tests.
- If Linux `process.report` has no `glibcVersionRuntime` and no musl shared object, `currentLibc()` stays `unknown`. Musl optional packages then look like missing current-platform metadata and recovery refuses. The original license error remains. That is fail-closed.
- The live success path did not execute recovery. Darwin `REVIEW` exit 0 does not show the Linux fallback.
- Static `REVIEW` is the existing unknown-license warning plus the static Maven warning. It is not a supply-chain job pass. Moderate and low advisories were not counted again. Root's earlier high 0 / critical 0 confirmation was not re-measured.
- pnpm's own JSON can drop same-level name collisions. The fallback includes each installed `name@version` it requested. The success path still returns pnpm's JSON unchanged.
- Engine `pnpm` ranges are compared with the catalog pin `10.19.0`, which this audit also checks against `package.json`. The Node version is `process.version`.

## Root review notes

Source edit is justified. Do not treat the Darwin license exit 0 as the CI fix. Do not treat this static REVIEW as remote CI. Re-run on Linux Node 20 / pnpm 10.19 with the frozen G447 lock if an independent runtime check is required. The expected Linux behavior is: licenses still throws the napi missing index, recovery omits that one engine-rejected optional and the foreign musl ids, current-platform installed manifests supply the groups, and a missing gnu/esbuild package or a denied installed license still fails.
