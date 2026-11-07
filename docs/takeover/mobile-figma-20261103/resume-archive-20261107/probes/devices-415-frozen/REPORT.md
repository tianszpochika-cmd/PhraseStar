# G415 MB025 devices bulk CTA — PREPARED_NOT_RUN repair

Status: **PREPARED_NOT_RUN**. No PASS. This session did not execute the lease, the observer, MySQL, IAM, Gateway, Chrome, or the nonce listener. It did not change Git, product source, credentials, ports, frozen G331/G383/G402 bytes, or repository handoff documents.

Writable directory: `/tmp/grok-mobile-resume-devices-repair-415`. G402 originals remain at `/tmp/grok-mobile-resume-devices-402`. Root receipt remains at `devices-402-root/receipt.json`.

## G402 actual

Root ran identity 402. Receipt:

- `status` FAIL
- `reason` `instrument-result-absent`
- `nodeStatus` 1
- `timedOut` false
- empty `runtime.log`
- no `instrument-result.json`
- ports and container released
- LEASE `staticStringGate` `FAILED_LITERAL_COUNT_FALSE_POSITIVE`, `preflight` PASS
- duration about 15s (`14:29:43` to `14:29:58`)

## Hook and module entry

Parent process is scratch-copied G318 `acceptance.mjs` with `NODE_OPTIONS=--require $scratch/lease-hook.cjs`.

Exact CJS seam, reached only after G318 `runPreflight` and HTTP checks:

1. `createRequire(import.meta.url)` loads `./browser-probe.cjs` and `./observe-auth.cjs` from the scratch harness.
2. `lease-hook.cjs` `Module._load` rewrites `CANONICAL_H5_ROOT` / `CANONICAL_H5_SHA` to B139 and replaces `openOwnedNonceStatic` with `openPinnedNonceStatic`.
3. The same hook replaces `observeAuth` with `runInstrument`, which spawns `device-others-owner-*.cjs`.

G318 `validateRepo` requires HEAD `034bac4565d3b8bae7fa6b27499fa174fd3d3364` and a clean tracked tree. G402 pointed `--repo` at the current mobile-resume worktree. That fails `repo.candidate` inside `runPreflight`, so `maybeRunOwnedAuth` never runs, the observer never starts, and no instrument file is written.

G402 also discarded probe stdio (`stdio: 'ignore'`) and deleted scratch (`node.stdout`, `node.stderr`, acceptance result) in `cleanup` after evaluate. Evaluate failed immediately on a missing instrument file, so the parent error never reached the public receipt.

## Exact repairs (415)

| File | Role |
| --- | --- |
| `device-others-owner-415.cjs` | Observer, identity 415, same bulk and independent assertions |
| `device-others-runtime.sh` | Supervisor lease, identity 415, G318 candidate `--repo`, diagnosis before scratch cleanup |
| `pinned-static-nonce.cjs` | B139 listener, header `x-mb004-static-qa` |
| `static-gate.cjs` | Parse-only compile plus required-string gate, `ctaEnabledExact` count 2 |
| `pin.json` / `output.json` / `REPORT.md` | Pins and this report |

Wrapper:

- `--repo` restored to `/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy` (G383/G318 candidate, jars present).
- Hook writes `hook-stage.json` at `hook-loaded`, `browser-probe-patched`, `observe-auth-patched`, `openPinnedNonceStatic`, `probe-spawn`, `probe-exit`.
- Probe stdio goes to scratch `probe.stdout` / `probe.stderr`. Child status goes to `probe-meta.json`.
- `persist_diagnosis` runs before evaluate and again in `cleanup` before `remove_scratch`. It writes `diagnosis.json` with categories and stage only.
- Receipt FAIL/PASS copies `parentErrorCategory`, `childErrorCategory`, `stage`, `hookStage`, `probeStatus`, `acceptanceStatus`, `firstFailedCheck`, `instrumentPresent`. No raw logs, cookies, bearers, or credentials.

Static-gate:

- `surface.ctaEnabledExact === true` must occur twice (assignment `ui.ctaEnabledExactBefore = ...`, then the bulk branch). That was the G402 false positive at count 1.
- Bulk exact, sequential-not-proof, independent refresh loop, `oldRefreshDenied === 2`, `actorStillAccepted === true`, and `ownerUnchanged === true` stay required.

Observer behavior unchanged except identity paths:

- Locator `.dev-cta[role="button"]`.
- One bulk click and one confirm, zero row exits.
- Sequential records then `sequential-not-bulk-proof` with zero row clicks.
- After `twoKicks === true`, both old WEB cookies are refreshed independently; current bearer and unrelated owner are checked even if a UI reason is set.
- `OBSERVED` still requires bulk exact plus both 401s, current stays, owner unchanged.

## Input pins (reviewed, not recomputed here)

Same SHA pins as G402. Preseeded 415 files matched G402 byte-for-byte before this repair:

| Item | SHA-256 / value |
| --- | --- |
| G402 observer original | `23c1fa467e909030f7c4fcd7c165285b88febb9457d73148f67c35af86f6e515` |
| G402 wrapper original | `0701a4265bfdd31a7441793a99d94c5c085fa5d248a63df5c3af82e583b7ce20` |
| 415 observer (this repair, not a frozen pin) | `1c00f73b0545898e2a39d328a7ff8af222a08010e33b585fcb71b4d773e550c5` |
| 415 wrapper (this repair, not a frozen pin) | `5071ced9ac45e95a998e584e12d398ff824a1778f1a212613320f5b08ac22e1a` |
| G331 observer | `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af` |
| B139 `index.html` | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| B116 index (rejected serve) | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |
| G318 acceptance / probe / observe | `9e72c956…` / `06e718d5…` / `fee4072c…` |
| MySQL image | `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` |
| Consent fixture | `apps/mobile/tests/fixtures/mock-consent-publication.json`, `SYNTHETIC_TEST_ONLY` |

## Actual checks versus NOT_RUN

| Check | Result |
| --- | --- |
| Read G402 root receipt, LEASE, empty runtime.log | done |
| Inspect G318 `validateRepo` / `openOwnedNonceStatic` / `observeAuth` entry | done |
| Confirm preseeded 415 == G402 originals | done (matching SHA-256) |
| Rebind identity 415; restore G318 `--repo`; persist diagnosis | done |
| Static-gate `ctaEnabledExact` count 2 | done |
| `node --check` observer / nonce / static-gate / extracted hook / redirect / persist | done, exit 0 |
| `bash -n` wrapper | done, exit 0 |
| `node static-gate.cjs` | done, `STATIC_GATE` / `executed: false` |
| Prefix mode `0700` | 415 dir was already `drwx------` |
| `--preflight-only` / lease / Chrome / IAM / Gateway / MySQL | **NOT_RUN** |
| Bulk CTA proof / old refresh 401 × 2 | **NOT_RUN** |
| PASS | not claimed |

## Remaining prerequisites

1. Invoke `/tmp/grok-mobile-resume-devices-repair-415/device-others-runtime.sh` as user Admin, uid 502, no sudo.
2. Prefix mode `0700`, owner uid 502. This script does not chmod the prefix.
3. Ports `13306`, `18070`, `18087`, `18183` idle on `127.0.0.1`.
4. Historical `/tmp/grok-mobile-device-others-revoke-h5-probe-331` still the G331 two-file snapshot.
5. Docker context `desktop-linux`, pinned MySQL image, JDK pin `/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home`.
6. Playwright at the archived worktree used by G383.
7. G318 seed still admits 3 `NOT_RUNTIME_VERIFIED` consent rows.
8. Root later hashes the 415 observer/wrapper if a digest pin is required.

## Safe validation command

Parse and string-gate only:

```sh
node /tmp/grok-mobile-resume-devices-repair-415/static-gate.cjs
node --check /tmp/grok-mobile-resume-devices-repair-415/device-others-owner-415.cjs
node --check /tmp/grok-mobile-resume-devices-repair-415/pinned-static-nonce.cjs
node --check /tmp/grok-mobile-resume-devices-repair-415/static-gate.cjs
bash -n /tmp/grok-mobile-resume-devices-repair-415/device-others-runtime.sh
```

After the prefix is `0700` and ports are free, supervisor-only:

```sh
bash /tmp/grok-mobile-resume-devices-repair-415/device-others-runtime.sh --preflight-only
bash /tmp/grok-mobile-resume-devices-repair-415/device-others-runtime.sh
```

The second command is the lease. A sequential receipt is a fail, not the bulk-button proof. `OBSERVED` plus wrapper `PASS` require one bulk click, one confirm, two kickout 200s, two refresh 401s, current bearer accepted, unrelated owner unchanged. A missing instrument file must still carry `parentErrorCategory`, `childErrorCategory`, and `stage` on the receipt.

## Boundaries

Frozen G331, G383 receipts, G402 originals and root receipt, B139 H5, consent mock fixture, and the product repository were left in place. No production writes. Secrets stay out of receipts. MB-025 remains `TRACE_PENDING` until a later supervisor run records the bulk path.
