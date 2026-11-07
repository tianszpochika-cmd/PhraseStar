# G402 MB025 devices bulk CTA — PREPARED_NOT_RUN

Status: **PREPARED_NOT_RUN**. No PASS. This session did not execute the lease, the observer, MySQL, IAM, Gateway, Chrome, or the nonce listener. It did not change Git, product source, credentials, ports, frozen G331/G383 bytes, or repository handoff documents.

## What was resumed

G394 snapshot `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/user-pause-20261106/worker-snapshots/394` authored a deriver that patched G331 `button.dev-cta` to `.dev-cta[role="button"]`. That deriver was not run. Sequential remained a valid readback shape.

G383 actual receipt `resume-20261105/device-guard-source-directory-383-root/receipt.json` is `FAIL` / `wire-outcome`. Instrument `FAILED` / `readback-mismatch` after operation `sequential`: two other-device kickouts HTTP 200, two confirms, zero bulk clicks, `ctaDisabledAfter` false, `oldRefreshStatuses` `[]`. Current session and unrelated owner stayed. The refresh loop sat behind `!browser.reason`, so the two old WEB cookies were never denied.

PAUSE-20261106: “批量按钮和旧会话刷新拒绝待验”.

## Current source and compiled controls

Current `apps/mobile/src/pages/devices/devices.vue` on this worktree renders one ready-state control:

```vue
<button
  tabindex="0"
  role="button"
  type="button"
  class="dev-cta"
  :disabled="busy || noIdentity || !revocableDevices.length"
  @click="openBulkConfirm"
>
```

Enabled label is `devicesPage.ctaOthers` with count, Chinese `退出其他设备（2）`. Disabled label is `devicesPage.ctaOthersDisabled`, Chinese `退出其他设备`. Confirm copy is `退出其他设备？` / `将结束其他 {count} 台设备的登录；当前设备会保留。`. The page then loops `kickoutMobileDevice` with a nonempty `Idempotency-Key`. There is no bulk IAM route.

B139 compiled H5 `reading-practice-integrated-g351-root/h5` uses `uni.f315d0bb.css` (`uni-button { ... }`) and `devices-CdLBDd4F.css` (`.dev-cta`). `button.dev-cta` misses that host. `.dev-cta[role="button"]` matches the compiled control. Disabled is the DOM `disabled` property or a `disabled` attribute whose value is not `false`. A missed node stays enabled-false and fails both exact matches. There is no `uni-button` selector.

## Exact changes

Complete candidates under `/tmp/grok-mobile-resume-devices-402`:

| File | Role |
| --- | --- |
| `device-others-owner-402.cjs` | Observer. G331 lease plus G394 locator/disabled, nonce header, bulk-only proof |
| `device-others-runtime.sh` | G383 supervisor lease, identity 402, B139 nonce static, bulk wire gate |
| `pinned-static-nonce.cjs` | G392/G388 listener, B139 only, header `x-mb004-static-qa` |
| `static-gate.cjs` | Parse-only compile plus required-string gate |
| `pin.json` | Reviewed pins, `recomputed` false |
| `output.json` | Expected bulk shape plus redacted G383 actual |
| `REPORT.md` | This file |

Observer versus frozen G331:

- Locator is `.dev-cta[role="button"]`. The same locator is clicked.
- Genuine disabled uses property/attribute. Playwright `isDisabled()` is not used.
- Bulk path: one click, one confirm, zero row exits.
- Sequential predicate `ctaCount === 1 && genuineDisabled && otherExit === 2` records `mode: sequential` and returns `sequential-not-bulk-proof` with zero row clicks.
- Two successful other kickouts then independently refresh both old WEB cookies, then current `principal/me`, then the unrelated owner snapshot. Those checks no longer require a cleared UI reason.
- `OBSERVED` still requires bulk exact plus both 401s, current stays, owner unchanged.
- Static GET/HEAD to `http://127.0.0.1:18183` continue with `x-mb004-static-qa`. Health GET `/` uses the same header. The nonce is deleted from the environment after read and is omitted from receipts.
- Output stays in this prefix (`oracle-result.json` standalone, `instrument-result.json` under the lease).

Wrapper versus G383:

- Identity 402, prefix `/tmp/grok-mobile-resume-devices-402`, label `cloudstudy.qa.mobile-resume-devices-402-`, container `cloudstudy-owner-402-`, MySQL user `o402` plus suffix.
- Served H5 is B139 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. B116 `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` is fail-closed and is not served.
- `openOwnedNonceStatic` is rebound to `openPinnedNonceStatic`. G383 `headerFree` is absent.
- Probe is `device-others-owner-402.cjs`. Frozen G331 remains a reviewed input pin and is not executed.
- Repo for AGENTS.md and `mock-consent-publication.json` is this worktree. Seed admission stays G318/G383 `NOT_RUNTIME_VERIFIED` (3 document rows). The devices actor is not given invented consent signatures, targets, or placement facts.
- Evaluate fails `sequential-not-bulk-proof` when `ui.mode === 'sequential'`. Wire still requires `ui.mode === 'bulk'`.
- Ports stay `127.0.0.1:13306`, `18070`, `18087`, `18183`. Learner/content/assessment are not started.
- Historical G331 directory is snapshotted and not deleted. Scratch is `scratch.*` under this prefix. Cleanup stops only the matching 402 container.

## Input pins (reviewed, not recomputed here)

| Item | SHA-256 / value |
| --- | --- |
| G331 observer | `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af` (43416 bytes) |
| G331 report | `527843fef5fa89868d1ac4e8d99f7c4a9f77e1654dfa0aa3a214eb389186d795` |
| B139 `index.html` | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| B116 index (rejected serve) | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |
| G318 acceptance / probe / observe | `9e72c956…` / `06e718d5…` / `fee4072c…` |
| Device harness probe / HTTP | `dad7f0db…` / `091ecd30…` |
| MySQL image | `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` |
| Nonce header | `x-mb004-static-qa` |
| Consent fixture | `apps/mobile/tests/fixtures/mock-consent-publication.json`, `SYNTHETIC_TEST_ONLY`, mock-mb004-terms/privacy/adult-v1 |

Mainline inspected: `dev@61b9ede7` from resume BEFORE.json. Product files were not edited.

## Actual checks versus NOT_RUN

| Check | Result |
| --- | --- |
| Read AGENTS.md, CURRENT-HANDOFF, STATUS, CURRENT-PROGRESS, PAUSE-20261106 | done |
| Read G394 snapshot and G383 receipt/instrument | done |
| Inspect current `devices.vue`, i18n, `devices.ts`, B139 H5 CSS/index | done |
| Author 402 observer, wrapper, nonce helper, static-gate, pins | done |
| `node static-gate.cjs` / `node --check` / `bash -n` | **NOT_RUN** (this job cannot execute a shell) |
| Prefix mode `0700` | **NOT_RUN** |
| `--preflight-only` | **NOT_RUN** |
| Lease / Chrome / IAM / Gateway / MySQL / listener | **NOT_RUN** |
| Bulk CTA proof | **NOT_RUN** |
| Old refresh 401 × 2 | **NOT_RUN** |
| Current session / unrelated owner | **NOT_RUN** |
| PASS | not claimed |

## Remaining prerequisites

1. Directory `/tmp/grok-mobile-resume-devices-402` mode `0700`, owner uid 502. This script does not chmod the prefix.
2. Invoke the wrapper as that absolute path, user Admin, uid 502, no sudo.
3. Ports `13306`, `18070`, `18087`, `18183` idle on `127.0.0.1`. Serialize with other mobile leases.
4. Historical `/tmp/grok-mobile-device-others-revoke-h5-probe-331` still the G331 two-file snapshot (result absent or unchanged).
5. Docker context `desktop-linux`, pinned MySQL image, JDK pin `/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home`.
6. Playwright at the archived worktree used by G383.
7. G318 seed still admits 3 `NOT_RUNTIME_VERIFIED` consent rows. Do not invent signed onboarding for the devices actor.
8. Root later hashes the new observer/wrapper if a digest pin is required. This session did not recompute hashes.

## Safe validation command

Parse and string-gate only:

```sh
node /tmp/grok-mobile-resume-devices-402/static-gate.cjs
node --check /tmp/grok-mobile-resume-devices-402/device-others-owner-402.cjs
node --check /tmp/grok-mobile-resume-devices-402/pinned-static-nonce.cjs
node --check /tmp/grok-mobile-resume-devices-402/static-gate.cjs
bash -n /tmp/grok-mobile-resume-devices-402/device-others-runtime.sh
```

After the prefix is `0700` and ports are free, supervisor-only:

```sh
bash /tmp/grok-mobile-resume-devices-402/device-others-runtime.sh --preflight-only
bash /tmp/grok-mobile-resume-devices-402/device-others-runtime.sh
```

The second command is the lease. A sequential receipt is a fail, not the bulk-button proof. `OBSERVED` plus wrapper `PASS` require one bulk click, one confirm, two kickout 200s, two refresh 401s, current bearer accepted, unrelated owner unchanged.

## Boundaries

Frozen G331, G383 receipts, G394 snapshot, B139 H5, consent mock fixture, and the product repository were left in place. No production writes. Secrets stay out of receipts. MB-025 remains `TRACE_PENDING` until a later supervisor run records the bulk path.
