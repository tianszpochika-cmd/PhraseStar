# G434 MB025 devices bulk CTA — PREPARED_NOT_RUN refresh-protocol repair

Status: **PREPARED_NOT_RUN**. No PASS. This session did not execute the lease, the observer, MySQL, IAM, Gateway, Chrome, or the nonce listener. It did not change Git, product source, credentials, ports, frozen G331/G383/G402/G415 bytes, or repository handoff documents.

Writable directory: `/tmp/grok-mobile-resume-devices-refresh-434`. G415 originals and receipts remain at `/tmp/grok-mobile-resume-devices-repair-415` and `resume-20261107/devices-415-root`. G402 originals remain at `/tmp/grok-mobile-resume-devices-402`.

## G415 actual

Root ran identity 415. Public receipt:

- `status` FAIL, `reason` `wire-outcome`, `nodeStatus` 0, `timedOut` false
- instrument present
- UI: `reachedDevices` true, mode `bulk`, bulkClicks 1, confirmClicks 1, rowExitClicks 0
- kickout HTTP statuses `[200, 200]`, paths exact, success after readback
- revoked tags 2, current tagged after, CTA disabled after
- current bearer stayed, foreign owner unchanged
- independent old WEB cookie refresh HTTP statuses `[403, 403]`
- probe counted those 403s as `oldRefreshAccepted: 2`, so required `401/401` is **not** proven
- G318 ledger `PARTIAL`, passed 183, `requiredFailed` 0, `firstFailedCheck` `repo.branch`

403 is not revocation proof and is not token-accepted. The G415 probe treated any non-401 as accepted.

## Refresh protocol diagnosis (source only, no runtime)

Independent refresh is a Node POST to IAM TLS `https://127.0.0.1:18087/api/v1/auth/token/refresh` with cookie `yuxuexing_refresh`. The HTTP Gateway never sees that Secure cookie (`apps/mobile/src/auth/gateway-auth.ts`; IAM filter comment). Gateway `BrowserOriginCsrfGlobalFilter` is therefore not this path.

Supported H5 protocol:

- Frontend: `mobileIamAuthClient.request('/auth/token/refresh')` with `withCredentials: true` and `data` omitted when there is no body refreshToken. The browser sends `Origin` of the page (`http://127.0.0.1:18183`) and the cookie. No CSRF synchronizer token: IAM disables Spring CSRF and uses the Origin filter instead.
- Proven B78/G318 helper `iamRequest` always injects `Origin: http://127.0.0.1:18183` and `Referer: http://127.0.0.1:18183/`. Cookie refresh omits `body` and sets `Content-Length: 0`.
- Contract `x-auth-transport.WEB_COOKIE`: cookie only; JSON must not contain `refreshToken`. Controller `@RequestBody(required=false)` then `presentedRefresh` for WEB.
- `IamRefreshCookieOriginFilter` applies to unsafe methods on `/api/v1/auth/*` that already present the refresh cookie. Trusted origins are learner loopback 18180 and 18183. Missing Origin and untrusted/missing Referer → `credentialed_referer_untrusted` → HTTP **403** `errorCode: FORBIDDEN`, `message: iam.auth.origin_untrusted`. Unit test `missingSourceIsForbidden` is cookie + no Origin/Referer → 403.
- Register/login in G415 succeeded without Origin because that filter does not apply until the refresh cookie exists. Refresh is the failing path.
- After Origin/Referer, a kicked WEB cookie should still be **401** (`SESSION_REVOKED` / `SESSION_NOT_FOUND` map to HTTP 401). That 401 requirement is not weakened.

G415 probe sent `Idempotency-Key` + `Cookie` + JSON body `{}` and no Origin/Referer. Node `https.request` does not add Origin. That matches the 403 unit test, so `[403, 403]` is an incomplete Node request, not proof the kicked session was accepted.

Classification is now tri-state:

- `denied`: exact 401 and no access token and no new refresh cookie `maxAge>0`
- `accepted`: token or rotated cookie issued, or HTTP 200
- `protocolRejected`: any other non-401, including 403 origin-untrusted

`OBSERVED` still requires `denied === 2`, `accepted === 0`, `protocolRejected === 0`, statuses `[401, 401]`. If a correctly protocolled refresh still returns 403, that is a product bug to record; this candidate does not disable CORS/CSRF or change the app.

## `repo.branch`

G318 `check('repo.branch', Boolean(branch), false, …)` is optional. The G318 IAM worktree has an empty current branch after intentional cleanup. The wrapper now accepts G318 `PASS` with 184/0 **or** `PARTIAL` with 183/0 when the only failed check is `id === 'repo.branch' && required === false`. No old branch is created and no git metadata is faked. The check remains explicit on the diagnosis (`firstFailedCheck` / category `repo-branch-optional`). Optional `repo.branch` no longer overwrites probe stage to `validate-repo`.

## Exact repairs (434)

| File | Role |
| --- | --- |
| `device-others-owner-434.cjs` | Observer, identity 434, Origin/Referer/no-body refresh, tri-state classification, same bulk/current/foreign assertions |
| `device-others-runtime.sh` | Supervisor lease, identity 434, G318 candidate `--repo`, optional `repo.branch` PARTIAL, diagnosis before scratch cleanup |
| `pinned-static-nonce.cjs` | B139 listener, header `x-mb004-static-qa` |
| `static-gate.cjs` | Parse-only compile plus required-string gate, including refresh protocol and `ctaEnabledExact` count 2 |
| `pin.json` / `output.json` / `REPORT.md` | Pins and this report |

Observer refresh POST matches B78/frontend: `Origin: http://127.0.0.1:18183`, `Referer: http://127.0.0.1:18183/`, cookie, Idempotency-Key, no JSON body, `Content-Length: 0`. Bulk remains one `.dev-cta[role="button"]` click and one confirm, zero row exits. Sequential still records then `sequential-not-bulk-proof`. Independent refresh still runs after `twoKicks === true`.

## Input pins (reviewed, not recomputed here)

| Item | SHA-256 / value |
| --- | --- |
| G415 observer original (preserved) | `1c00f73b0545898e2a39d328a7ff8af222a08010e33b585fcb71b4d773e550c5` |
| G415 wrapper original (preserved) | `5071ced9ac45e95a998e584e12d398ff824a1778f1a212613320f5b08ac22e1a` |
| G415 public receipt | `a303c47073c2d98acf3b7e0c4e9a0abad89e6765c96a60ed0b6388c669522d57` |
| 434 observer (this repair, not a frozen pin) | `09ed4f967ede127b75849a201a00a946455e73b77a3dea8b2543ba4605103eaf` |
| 434 wrapper (this repair, not a frozen pin) | `6396027e9365f81fb54580015163164db3224aa8da6e46e463c79faf0ef41df9` |
| G331 observer | `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af` |
| B139 `index.html` | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| B116 index (rejected serve) | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |
| G318 acceptance / probe / observe | `9e72c956…` / `06e718d5…` / `fee4072c…` |
| MySQL image | `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` |
| Consent fixture | `apps/mobile/tests/fixtures/mock-consent-publication.json`, `SYNTHETIC_TEST_ONLY` |

## Actual checks versus NOT_RUN

| Check | Result |
| --- | --- |
| Read G415 root receipt, instrument, diagnosis | done |
| Diagnose Origin/Referer/cookie from IAM filter, Gateway contract, B78 `iamRequest`, frontend refresh | done, no runtime |
| Rebind identity 415→434 (observer filename, pins, gate, report, env, labels) | done |
| Refresh protocol + tri-state; exact 401 still required | done |
| Optional `repo.branch` PARTIAL; no branch created | done |
| `node --check` observer / nonce / static-gate | done, exit 0 |
| `bash -n` wrapper | done, exit 0 |
| extracted hook / redirect / evaluate `node --check` | done, exit 0 |
| `node static-gate.cjs` | done, `STATIC_GATE` / `executed: false` |
| Prefix mode `0700` | 434 dir already `drwx------` |
| `--preflight-only` / lease / Chrome / IAM / Gateway / MySQL | **NOT_RUN** |
| Bulk CTA proof / old refresh 401 × 2 | **NOT_RUN** |
| PASS | not claimed |

## Remaining prerequisites

1. Invoke `/tmp/grok-mobile-resume-devices-refresh-434/device-others-runtime.sh` as user Admin, uid 502, no sudo.
2. Prefix mode `0700`, owner uid 502. This script does not chmod the prefix.
3. Ports `13306`, `18070`, `18087`, `18183` idle on `127.0.0.1`. Qida 18091 stays untouched.
4. Historical `/tmp/grok-mobile-device-others-revoke-h5-probe-331` still the G331 two-file snapshot.
5. Docker context `desktop-linux`, pinned MySQL image, JDK pin `/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home`.
6. Playwright at the archived worktree used by G383.
7. G318 seed still admits 3 `NOT_RUNTIME_VERIFIED` consent rows.
8. Root later hashes the 434 observer/wrapper if a digest pin is required.

## Safe validation command

Parse and string-gate only:

```sh
node /tmp/grok-mobile-resume-devices-refresh-434/static-gate.cjs
node --check /tmp/grok-mobile-resume-devices-refresh-434/device-others-owner-434.cjs
node --check /tmp/grok-mobile-resume-devices-refresh-434/pinned-static-nonce.cjs
node --check /tmp/grok-mobile-resume-devices-refresh-434/static-gate.cjs
bash -n /tmp/grok-mobile-resume-devices-refresh-434/device-others-runtime.sh
```

After the prefix is `0700` and ports are free, supervisor-only:

```sh
bash /tmp/grok-mobile-resume-devices-refresh-434/device-others-runtime.sh --preflight-only
bash /tmp/grok-mobile-resume-devices-refresh-434/device-others-runtime.sh
```

The second command is the lease. A sequential receipt is a fail, not the bulk-button proof. `OBSERVED` plus wrapper `PASS` require one bulk click, one confirm, two kickout 200s, two refresh 401s after Origin/Referer/cookie protocol, current bearer accepted, unrelated owner unchanged. HTTP 403 remains `protocolRejected`, never denial and never accepted. A missing instrument file must still carry `parentErrorCategory`, `childErrorCategory`, and `stage` on the receipt.

## Boundaries

Frozen G331, G383 receipts, G402 originals, G415 originals and failure receipts, B139 H5, consent mock fixture, and the product repository were left in place. No production writes. Secrets stay out of receipts. MB-025 remains `TRACE_PENDING` until a later supervisor run records the bulk path with independent 401/401.
