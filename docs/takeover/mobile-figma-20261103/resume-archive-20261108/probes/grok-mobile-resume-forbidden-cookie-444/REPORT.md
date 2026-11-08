# MB-005 forbidden H5 cookie diagnosis (G444)

444 lease status: `NOT_RUN`. This session did not start Docker, Java, Chrome, Gateway, IAM, MySQL, or a listener. No `PASS` is claimed. G435 receipts, the frozen B139 bundle, and product source were not modified.

## G435 result, unchanged

Root ran `/tmp/grok-mobile-resume-forbidden-flow-435` once on 2026-11-08. Supervisor `resume-20261108/forbidden-435-root` records preflight `PASS_PYTHON312`, exit 1, result `FAIL_COOKIE_NOT_CLEARED`, then `RELEASED_INDEPENDENTLY_VERIFIED`.

| Fact | Record |
| --- | --- |
| Register | one `POST /api/v1/auth/register` `201` via IAM |
| Gate | one `POST /api/v1/iam/adult-gate` `200` via Gateway: `REJECTED`, `RESTRICTED`, evidence `REJECTED`, policy `b30-adult-v1`, minimum age 18, `retryAllowed` true |
| Principal | `RESTRICTED`, adult `REJECTED`, access `RESTRICTED` |
| Rendered | adult title and description, one enabled logout host |
| Logout | one `POST /api/v1/auth/logout` `200` via Gateway, body `REVOKED` / `CURRENT_SESSION_AND_TOKEN_FAMILY` |
| After logout | login title `欢迎回来`, path `/pages/login/login` |
| Writes | learning, consent, and target counts 0; `routeFulfillCount` 0 |
| Failure | `cookieCleared` false, reason `cookie-not-cleared` |
| Cleanup in that receipt | ports free; Java recounted `reaped` 2, `signaled` 0, `remaining` 0, `unverified` 0; tail `reaped` 1; Chrome remaining 0; `containerFacts.currentReleased` true; `containerReleased` false is the frozen boolean |

Those cleanup facts are the current confirmation for G435. 444 does not reap another project's processes or containers. Its own later cleanup still uses `reap_settled`: `remaining == 0`, `unverified == 0`, and `signaled <= reaped`.

## Verdict

G435's `cookie-not-cleared` is an observer assertion bug. It does not prove the browser jar still held `yuxuexing_refresh`, and it does not prove the clear header was absent. The same source also has a real H5 transport bug that a corrected probe must be allowed to fail on. Family revocation does not satisfy cookie clearing.

Playwright 1.63, the client this observer loads, implements page `response.headersArray()` as `async`. It reads `rawResponseHeaders`, which is where `Set-Cookie` is visible. The synchronous deprecated `headers()` returns provisional headers and does not include `Set-Cookie`. G435 called `headersArray().filter(...)` without awaiting it. That throws before `cookieCleared` can become true. The response listener swallows the throw. Logout status, `REVOKED`, and `CURRENT_SESSION_AND_TOKEN_FAMILY` were already stored, which matches the receipt. The later jar read can only force `cookieCleared` false. It cannot repair a thrown header read, and the receipt stored no separate jar boolean.

The transport bug is in the current mobile client and in the frozen B139 bundle, which has the same split. Register, login, and refresh use `https://127.0.0.1:18087` with `withCredentials: true` and no `X-Auth-Transport` header, so IAM defaults to `WEB_COOKIE`. H5 `deviceType` is `H5`, which IAM treats as non-native, so that default matches. IAM's clear and set builder is `HttpOnly`, `Secure` (this lease forces `IAM_JWT_REFRESH_COOKIE_SECURE=true` even on the local profile), `SameSite=None`, `Partitioned`, `Path=/api/v1/auth`, and logout uses `Max-Age=0`. Logout and revoke then go through `mobileApiClient` to `http://127.0.0.1:18070`. Gateway forwards that `Set-Cookie` for this transport: `BrowserOriginCsrfGlobalFilter.preventSetCookie` runs only for the official-site profile and for `X-Auth-Transport: NATIVE_SECURE_STORAGE`. H5 sends neither.

The page origin is `http://127.0.0.1:18183`. A credentialed call to HTTPS IAM is schemeful cross-site. A credentialed call to the HTTP gateway is schemeful same-site. The refresh cookie is stored from the cross-site HTTPS response. A `Secure; Partitioned` clear on the HTTP gateway response is not the same cookie operation, even though loopback HTTP can accept a `Secure` attribute. Chrome's loopback exception is not a reason to ignore a surviving jar cookie. `apps/mobile/tests/iam-auth-transport.test.mjs` currently locks logout onto `http://127.0.0.1:18070/api/v1/auth/logout`.

## 444 probe

Same guarded adult flow: one new `g444-` actor, one register, one exact gate denial, the real principal, the adult copy, one enabled `uni-button` logout host, one logout, and the login landing. No `context.clearCookies`, `addCookies`, auth injection, mocked response, or forced route. Logout remains the product's Gateway POST. Learning, consent, and target writes stay blocked.

`cookieCleared` is true only when all of these hold:

- Before the click, the jar has a non-empty `yuxuexing_refresh` at path `/api/v1/auth` that is still live.
- The logout `Set-Cookie` was read from the awaited header list and has an empty value, `Max-Age` exactly 0, a past `Expires`, `Path=/api/v1/auth`, `Secure`, `HttpOnly`, `SameSite=None`, and `Partitioned`.
- After logout, no live jar cookie remains at that name and path.

A thrown or non-array header list is `cookie-header-unreadable`. No stored cookie is `cookie-not-stored`. A readable header that misses those attributes, or a jar cookie that remains, is `cookie-not-cleared`. Header presence alone cannot pass. Revocation alone cannot pass. The receipt stores attribute booleans, counts, and `clearOverHttps` only. It does not store cookie values, raw headers, or HTML.

Offline `runCookieMatcherChecks()` covers exact path versus `/`, `/api/v1/auth-extra`, and `/api/v1/auth/extra`; `Max-Age` 0 versus 10 and 01; a prefixed cookie name; an empty jar value; an expired jar cookie; a session jar cookie; a full clear; a remaining jar cookie; a missing `Partitioned` attribute; an unreadable header; and a logout with no stored cookie.

## Product patch, not applied

Do not edit the frozen B139 bundle to make 444 green. For the current H5 source, send browser logout and current-session revoke to IAM TLS with the in-memory bearer and `withCredentials`. Leave password posts on the bearer-less IAM client. Leave native logout on the Gateway client.

`apps/mobile/src/api/client.ts`: add a bearer IAM client beside `mobileIamAuthClient`.

```ts
export const mobileIamBearerClient = createMobileApiClient(
  requireIamAuthBaseUrl(getIamAuthBaseUrl()),
  undefined,
  getInMemoryAuthRequestSnapshot,
)
```

`apps/mobile/src/auth/gateway-auth.ts`: for `logout` and `revoke`, use `mobileIamBearerClient` when `isNativeAppRuntime()` is false, and `mobileApiClient` when it is true. Do not add `X-Auth-Transport`. IAM already allows `http://127.0.0.1:18183` on credentialed `/api/v1/auth` requests.

Required tests, after that patch:

- Update `apps/mobile/tests/iam-auth-transport.test.mjs` so the H5 logout and current-session revoke URLs are `https://127.0.0.1:18087/api/v1/auth/logout` and the revoke path, on the bearer IAM client. Assert `withCredentials === true`, an `Authorization` bearer taken from the in-memory snapshot, and no `X-Auth-Transport`. Keep password posts on the bearer-less IAM client. A native runtime still uses the Gateway client.
- Add a client case beside the existing bearer-less login case: `mobileIamBearerClient` posts `/auth/logout` to `https://127.0.0.1:18087/api/v1/auth/logout` with `withCredentials === true` and `Authorization: Bearer` from the snapshot.
- Add an IAM controller test that a `WEB_COOKIE` current-session logout emits one `Set-Cookie` whose attributes are the name `yuxuexing_refresh`, an empty value, `Path=/api/v1/auth`, `Max-Age=0`, a past `Expires`, `Secure` when refresh cookies are secure, `HttpOnly`, `SameSite=None`, and `Partitioned`.

No test may pass by clearing the jar, injecting a cookie, or fulfilling the logout response.

Gateway code does not need a forwarding change for this bug. A later 444 run that shows `headerPathMatch`, `headerMaxAgeZero`, `headerSecure`, and `headerPartitioned` true with `clearOverHttps` false and `jarRemains` true confirms the HTTP clear did not remove the HTTPS-partitioned cookie.

## Root command

One serialized run, after review, only when `13306`, `18070`, `18087`, and `18183` are free:

```text
/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-forbidden-cookie-444/forbidden-h5-wrapper.py
```

Exit 0 is `PREFLIGHT` or `OBSERVED` with cleanup. Exit 2 is a closed pin, argv, replay, or scratch refusal. Exit 1 is any other failure, including `cookie-not-cleared` when the jar cookie remains. An observer pass with incomplete cleanup stays a failed lease.

| Item | Value |
| --- | --- |
| Job | `MB005-H5-FORBIDDEN-444` |
| Rebinds | `MB005-H5-FORBIDDEN-435` |
| Container | `cloudstudy-mobile-forbidden-cookie-444` |
| Label | `cloudstudy.qa.scope=cloudstudy.qa.mobile-forbidden-cookie-444` |
| Source head | `61b9ede7c65ef065c76c846c27fb69a52cd042cd` |
| B139 index | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |

Codex reserve 20 is unchanged. If cleanup is incomplete, root may remove only this job's container after confirming the label, and only `/tmp/grok-mobile-resume-forbidden-cookie-444/scratch`. Do not delete the 444 scripts, the 435 tree, or unrelated Java.
