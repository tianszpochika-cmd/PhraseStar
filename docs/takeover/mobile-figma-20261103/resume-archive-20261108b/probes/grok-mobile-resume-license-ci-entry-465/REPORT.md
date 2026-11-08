# G465 CI entry for the license inventory tests

STATUS: `CI_ENTRY_WIRED` / new `tests/p1r` entry exit 0, 10/10 cases / Linux store `NOT_RUN` / remote CI `NOT_RUN`.

G461 receipts under `/tmp/grok-mobile-resume-license-finish-461` were not rewritten. No git write, install, package.json edit, policy edit, lock edit, Docker, JVM, browser, listener, or live API.

## What changed

`pnpm test:p1r` is `node scripts/dev/run-node-tests.mjs tests/p1r`. That runner only collects `tests/p1r/**/*.test.mjs`. The helper cases lived in `scripts/audit/p1r-node-license-inventory.test.mjs`, so CI never loaded them.

New entry: `tests/p1r/p1r-node-license-inventory.test.mjs`. It imports the audit test module. `node:test` then registers those cases on this file. The entry does not copy assertions.

The live install case no longer forces `{ os: 'darwin', cpu: 'arm64' }`. It reads this checkout's `pnpm-lock.yaml` and inventories `node_modules` for `process.platform` / `process.arch` / `currentLibc()` / `process.version`. Repo root comes from `import.meta.url`, not a machine path. `@napi-rs/lzma-linux-x64-gnu@1.5.1` is included only when `legitimateAbsence` is null; otherwise that exact absence reason must be recorded and the package must be out of the groups. `@rollup/rollup-linux-x64-gnu@4.62.4` and the musl build follow the same rule, so a current-platform gnu build stays required. Installed MIT `@alloc/quick-lru@5.2.0` and Unknown `@dcloudio/uts` stay required. Denied licenses still fail the group check. The other nine cases are unchanged.

Those two package ids and the napi engines/os/cpu/optional facts are in the committed lock at `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db` and in the worktree lock. The fixture does not point at an external G447 directory.

Helper `scripts/audit/p1r-node-license-inventory.mjs` and checker `scripts/audit/p1r-dependency-audit.mjs` are the G461 bytes. Policy and allowlist are unchanged. Unknown stays review. Denied stays fail. High/critical gate code was not edited.

## Actual exits

| Command | Exit | Result |
|---|---|---|
| `node --test scripts/audit/p1r-node-license-inventory.test.mjs` | 0 | 10 pass, 0 fail, 0 skipped, duration_ms 802.073292. Same 10 names. Stderr is the `NO_COLOR`/`FORCE_COLOR` warning. |
| `node scripts/dev/run-node-tests.mjs tests/p1r/p1r-node-license-inventory.test.mjs` | 0 | Runner log: `discovered 1 test file(s)`. Then the same 10 names, 10 pass, 0 fail, duration_ms 752.310958. |
| Full `pnpm test:p1r` (all of `tests/p1r`) | NOT_RUN | A directory walk using the runner's rules finds 43 `*.test.mjs` files and includes `tests/p1r/p1r-node-license-inventory.test.mjs` at index 36. The other 42 files were not executed. List: `p1r-discovery.txt`. |
| Linux Node 20 store / `pnpm licenses` on Linux | NOT_RUN | This host is Darwin arm64, Node v20.19.5, pnpm 10.19.0. The entry ran here. |
| Remote CI | NOT_RUN | |

Host result for the install case: recovery ok, napi absent as a foreign-platform package, gnu and musl rollup builds absent, quick-lru MIT present, `@dcloudio/uts` Unknown present, no denied group, more than 900 names.

## Hashes

G461 accepted bytes, unchanged this round:

- `scripts/audit/p1r-dependency-audit.mjs` `3ce778f64a719eecddae86538e50722db92d02c2f4ddf4e8627d2e3f887ae29b` 19532
- `scripts/audit/p1r-node-license-inventory.mjs` `9b7ac1e6a9902452ae54c49b0084fe73cd39f175adafdf3e1ad888ce26b568c6` 18892
- G461 test baseline `42b8abd59e135ca6646987182e9ac7456118ab1303eb7f01f0c2a9cd97c9f5ab` 19062 (`preexisting/p1r-node-license-inventory.test.mjs`, extracted from the G461 diff and rehashed)

Final candidate:

- `scripts/audit/p1r-node-license-inventory.test.mjs` `1b74d4a337e539f5ea9cf4a7b134bb207fedee84e96b98ea28a19a0ada0058b9` 20165
- `tests/p1r/p1r-node-license-inventory.test.mjs` `388774b74043a9462592ef5256e9eb850ed43e9a57a4b32941179db633febe34` 224

Unchanged from the G461 snapshot: `package.json` `e2bf8a40...`, `config/p1r-dependency-policy.json` `158a07e1...`, `pnpm-lock.yaml` `762e018c...`, `pnpm-workspace.yaml` `e0dec117...`, `apps/mobile/package.json` `e08004d9...`, admin/learner/official package.json hashes in `source-manifest.txt`.

`exact.diff` is 65 lines: G461 test versus the current test, then the new CI entry against `/dev/null`.

## Remaining risks

- Linux execution of this entry is still unproven. On Linux x64 glibc Node 20 the same assertions require `@rollup/rollup-linux-x64-gnu@4.62.4` to be installed and require the napi package and the musl build to be absent. If `currentLibc()` stays `unknown`, the musl build is not a proven absence and this install case fails closed.
- The case needs `node_modules/.pnpm` from a pnpm install of the checkout lock (`semver@7` and `yaml@2`). An empty checkout fails while resolving those packages.
- Full `tests/p1r` was not executed, so this run does not show interactions with the other 42 files.
- Remote supply-chain CI was not run. Darwin `REVIEW` from G461 is not a new result of this round.
