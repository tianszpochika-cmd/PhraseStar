# G450 mobile H5 IAM TLS logout / current-session-revoke transport

Job: `G450-H5-IAM-LOGOUT-TRANSPORT`  
Checkout: detached `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`  
Git/index/branch: unchanged (no add/commit/checkout)  
Date: 2026-11-08

G441/G445 four files stay preexisting dirty bytes in this tree, byte-identical to the independently reviewed 39/39 + 5 manual cases integrated as `dev@924bb073`. They are excluded from `exact-new.diff`.

G444's corrected probe remains `NOT_RUN`. This session does not claim a proven runtime cookie-jar bug. G435 `FAIL_COOKIE_NOT_CLEARED` is an observer assertion plus a source transport split; family revocation is not cookie clearing.

## What changed

H5 password/login/register/refresh stay on the bearer-less IAM TLS client (`mobileIamAuthClient`, forced `{ accessToken: null, identity: null, revision: 0 }`, `withCredentials: true`).

A second IAM client, `mobileIamBearerClient`, uses the same HTTPS IAM base and `getInMemoryAuthRequestSnapshot`. H5 `logout` and current-session `revoke` use that client. Native `isNativeAppRuntime()` keeps Gateway `mobileApiClient` for those two calls.

No `X-Auth-Transport` header is added. Access tokens and passwords are not persisted. IAM ownership, Gateway auth guards, and the frozen B139 bundle are untouched. Logout still uses `skipAuthRetry: true`, `authBootstrap: 'logout'|'revoke'`, and existing idempotency keys. `invalidateLearningIdentity()` still clears subject/caches and keeps the in-memory access token until `clear()` after success. Logout is not mocked.

Cookie-clear attributes already exist in IAM (`Path=/api/v1/auth`, empty value, `Max-Age=0`, past `Expires`, `HttpOnly`, `SameSite=None`, `Partitioned`, `Secure` when `refreshCookieSecure`). This job adds unit coverage only.

## Source

| Path | Role |
| --- | --- |
| `apps/mobile/src/api/client.ts` | export `mobileIamBearerClient` |
| `apps/mobile/src/auth/gateway-auth.ts` | H5 logout/revoke → bearer IAM; native → Gateway |
| `apps/mobile/tests/iam-auth-transport.test.mjs` | H5 HTTPS + credentials + in-memory bearer; native Gateway; no password bearer |
| `apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs` | real adapter logout/revoke origin, credentials, bearer, no transport header |
| `apps/mobile/tests/onboarding-auth-projection.test.mjs` | mock `mobileIamBearerClient` + H5 runtime |
| `services/iam-service/src/test/java/com/englishflow/iam/web/IamLogoutCookieClearControllerTest.java` | WEB_COOKIE current-session logout/revoke cookie-clear attributes |

No other product source. IAM controller cookie builder was already correct; no production Java change.

## G441/G445 preexisting (preserved, not in exact-new.diff)

| path | HEAD `ed6a1e57` | worktree (reviewed G441) |
| --- | --- | --- |
| `config/p1r-data-ownership.v1.json` | `384303265eb8e85f237f86aa8f9f57ed9fedf9557cfeb766d77826e2a29b8997` | `31333598faae95b7216599b8965c16e4b8f56f249e92131980d78eae585b3d9f` |
| `scripts/audit/p1r-data-ownership-check.mjs` | `93d5f600aada211151703dba8312833c47597ae6ca10eb3b5db71263157d3be1` | `5b25a2fd3f74265eebb78df8efa635c6a44e70af97e516c084414d6213578ddb` |
| `tests/p1r/p1r-data-ownership.test.mjs` | `bca2be8b3c632a347442fe3174efdf59ee2769ae8f5d7e6036c67dd16b6a6940` | `ba01cbdfe9ba6128ea049a9b315298ec80b3ab53630ff68946d5cff1d3d2a420` |
| `tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs` | `3b92d342b8d5daafbab9f6d86bcf791a63677af179361dce953859e64daf9057` | `a68a0031704b839980d94066902178b42b8e9fca9b36c8b4b4f235e790e19a86` |

Worktree hashes match the G441/G445 review pins. `git diff --stat` on these four files is still 10/174/92/39.

## G450 hashes (sha256)

| path | HEAD | worktree |
| --- | --- | --- |
| `apps/mobile/src/api/client.ts` | `c332170a0ac228d8e8a15329df9e75a423f6ec8414ab044776ae0cba78a50e84` | `136f297ddad8337bcf4125026455aec51ecdc8db951d398cab758eb90c0dd16f` |
| `apps/mobile/src/auth/gateway-auth.ts` | `746bb9d83d241162bce9d9cd701d2f6662d11a132977533e3ba2a11e428c3277` | `08f59285061940606e8eb520c50cb4c81f8881539b52ba366aab525388971ab1` |
| `apps/mobile/tests/iam-auth-transport.test.mjs` | `a7bbb400f1d474c670a7cd60173564a4e804c195054132cb1a135145305b271c` | `08db1dd787b76091907fa02d7072ff9e2223f91de15d23c1908782f49ef93478` |
| `apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs` | `55b983568a6be5a56be4a01cd0c8c478c29f0dc9f8bec774f971f9e2e3409a97` | `30901b7a4282f1526a8f54e576afd22a9890b1f74afb2480c5a713e7478d9c89` |
| `apps/mobile/tests/onboarding-auth-projection.test.mjs` | `3f55fb099464119c6575926b2e67c2a8ed73428facb9eb4b4fd029c2e0a1aeaa` | `59f0fa23808ae2253b64d54360737b11852a762d5ab0557920bf2f6b40cbe5a4` |
| `.../IamLogoutCookieClearControllerTest.java` | (untracked) | `d9cfc5c46380a4e9ee166a738b70df5eb0dabd6c93bcda4dae6fe96d5d90d864` |

`exact-new.diff` sha256 `29ca6b8d8629386db2774bfc07dafcad2540341e535f28be84aebbbd4041c53e` (481 lines). Six G450 paths only.

`apps/mobile/node_modules` is gitignored. This session did not create or edit those links.

## Tests

Node v20.19.5. `env -u NODE_PATH node scripts/dev/run-node-tests.mjs ...`. No install, no `node_modules` mutation, no H5 build.

### Focused (G450)

`apps/mobile/tests/iam-auth-transport.test.mjs`  
`apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs`  
`apps/mobile/tests/onboarding-auth-projection.test.mjs`

**29 pass / 0 fail**, duration 924.751875 ms, EXIT 0.

Covered:

- H5 login/register/password-reset/refresh → `https://127.0.0.1:18087` bearer-less IAM
- H5 logout → `https://127.0.0.1:18087/api/v1/auth/logout` on `mobileIamBearerClient`
- H5 current-session revoke → `https://127.0.0.1:18087/api/v1/auth/sessions/session-1/revoke` on that client
- `withCredentials === true`, `Authorization: Bearer` from the in-memory snapshot, no `X-Auth-Transport`
- native login stays IAM TLS; native logout/revoke stay `http://127.0.0.1:18070` Gateway
- password posts never send the current bearer

### Full mobile suite (official run)

`node scripts/dev/run-node-tests.mjs apps/mobile/tests`  
log: `mobile-all-tests.valid.log` sha256 `cdbb16d0a332c20c040a21128a97cb117f612be360895e211824c51855af7505`

| item | result |
| --- | --- |
| files | 85 |
| tests | 682 |
| pass | 655 |
| fail | 27 |
| duration_ms | 15377.5365 |
| EXIT | 1 |

G450 auth cases in this run: ok (iam-auth-transport 5, bootstrap logout/revoke, onboarding projection). G440 same-commit baseline in a fully installed checkout was 85 files / 680 pass. This run has 682 tests because iam-auth-transport gained two cases.

The 27 failures are `Unknown file extension ".ts"` for  
`/Users/Admin/.codex/worktrees/mobile-deps-20261108/cloudstudy/packages/design-tokens/src/mobile.ts`.  
At run time, Root's first prereq (`ROOT-PREREQ.json`) was a whole-directory `apps/mobile/node_modules` symlink into `mobile-deps-20261108`, so `@englishflow/design-tokens` resolved outside this checkout. The mobile TS loader only transpiles files inside this tree. Files: `mobile-experience-runtime-hydration.test.mjs` (15) and `mobile-performance-runtime.test.mjs` (12). They do not import the G450 auth adapter.

After that run, Root wrote `ROOT-PREREQ-CORRECTED.json` (2026-11-08T01:10:29Z) remapping `@englishflow/*` onto this checkout's `packages/*`. This session did not run the suite a second time. `ROOT-FULL-MOBILE-REVIEW.json` is Root's later `exit: 0` pin of the G450 source hashes; it is not this session's suite log.

An earlier log `mobile-all-tests.log` used Desktop `apps/mobile/node_modules` as `NODE_PATH` (648/682, extra 7 SRS fails). That env is invalid. This session's suite evidence is `mobile-all-tests.valid.log`.

### IAM controller (after home-405 EXIT.json)

Prereq: `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/home-405-prereq-build/EXIT.json` = `{"exit": 0, "at": "2026-11-08T00:50:21.110412+00:00"}`.

`JAVA_HOME=/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home`  
`/Users/Admin/.local/tools/maven/bin/mvn` 3.10.0, `-B -ntp -o`, `-Dtest=IamLogoutCookieClearControllerTest`.

Serialized with Python `fcntl.flock` on `/tmp/cloudstudy-maven.lock` (macOS has no `flock` binary). Did **not** set `-Daether.syncContext.named.factory=noop`.

This sandbox cannot create files under `~/.m2` (`Operation not permitted` on `~/.m2/repository/.locks`). Two first Maven starts failed there with FileLockNamedLockFactory "after 5 attempts". The successful run kept the file-lock factory and set `-Daether.syncContext.named.basedir.locksDir=/tmp/g450-aether-locks` so lock files could be created. Log: `iam-cookie-clear-maven.log` sha256 `21f45becf04641398c5afe10639044970dbaebb4311a9f642bfb27e3f49826fb`.

**Tests run: 3, Failures: 0, Errors: 0, Skipped: 0. BUILD SUCCESS.** Finished 2026-11-08T09:09:19+08:00, 5.590 s.

- `webCookieCurrentSessionLogoutClearsRefreshCookieAttributes`
- `webCookieCurrentSessionRevokeClearsRefreshCookieAttributes`
- `webCookieLogoutOmitsSecureWhenRefreshCookieIsNotConfiguredSecure`

Assertions on one `Set-Cookie` `yuxuexing_refresh=`: `Path=/api/v1/auth`, empty value, `Max-Age=0`, past `Expires`, `HttpOnly`, `SameSite=None`, `Partitioned`, `Secure` when configured.

Full IAM suite: **NOT_RUN**.

## NOT_RUN / not claimed

| item | status |
| --- | --- |
| G444 corrected browser probe | `NOT_RUN` |
| Live cookie-jar / `clearOverHttps` | `NOT_RUN` (Root serialized browser later) |
| H5 build | G447 owns it |
| Frozen B139 bundle edit | not done |
| Contract / OpenAPI change | none (transport-only) |
| Docker, listeners, live HTTP, Chrome | none |
| Git writes, installs, node_modules mutation | none |
| Full IAM `mvn test` | not run |
| Product DoD / deployment | not claimed |

G435 receipt facts stay as recorded: register 201 IAM, adult-gate REJECTED via Gateway, logout 200 via Gateway in that run, `cookieCleared` false. This patch retargets current H5 source logout/revoke to IAM TLS; it does not replay that browser.

## Ownership

- IAM remains the only token issuer and cookie setter/clearer for `yuxuexing_refresh`.
- Gateway still owns `/api/v1` routing; H5 session lifecycle for logout/current revoke now calls IAM TLS directly so the clear `Set-Cookie` is same-origin as the Secure Partitioned cookie.
- Native session lifecycle stays on Gateway + secure storage.
- Password posts stay bearer-less IAM TLS.
