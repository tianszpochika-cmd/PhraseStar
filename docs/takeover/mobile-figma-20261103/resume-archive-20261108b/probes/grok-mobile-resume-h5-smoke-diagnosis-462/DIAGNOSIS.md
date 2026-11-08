# G456 live FAIL diagnosis (immutable) → G462 policy

G456 was run once by Root. Receipts stay unchanged. This file is a diagnosis of that FAIL, not a rewrite of it.

## Immutable evidence

| item | path / value |
|---|---|
| run | `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/current-h5-456-root/run-receipt.json` |
| cleanup | `.../current-h5-456-root/cleanup-receipt.json` |
| EXIT | `{"exit": 1}` at `.../EXIT.json` |
| at | `2026-11-08T01:26:30.199Z` elapsed 9758 ms |
| matrix | 75 navigations, pass 0, fail 75, `failedStage: complete` |
| cleanup | `ok: true`, `playwrightProcessMethodUsed: false`, `passBecauseProcessMissing: false` |
| tree | unchanged; index `7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8`; tree `f2ab7809b9d08d9bc8e342314e12c0b16d09628cfab62351390dd21e5f11740e` |
| server counts | static 1012, staticMiss 0, nonstatic 0 |
| H5 | frozen G447 `dependency-447-reviewed/h5`, not G457 |

G456 source SHA-256 from frozen MANIFEST: `ffb2c6614b0d2a8e96e026afc76bfba258e71a3d7f171ccd7b9e1cfba54500d0`.

## Cause 1 — hash-only `page.goto` returns null

Playwright 1.63 `types.d.ts` `Page.goto` (lines 7740–7741):

> The method either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

G456 `exerciseRoute`:

```js
const target = `http://127.0.0.1:18183/#/${route}?theme=${theme}&uiLocale=zh-CN`
const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 })
const navNonce = response ? response.headers()[NONCE_HEADER] : null
if (navNonce === nonce) passRow(row, 'nonce-nav-header', navNonce)
else failRow(row, 'nonce-nav-header', nonce, navNonce)
```

Same page/context walks 33 hash URLs. The first `goto` is a document load and returns a Response whose headers include `x-g447-h5-nonce`. Later `goto` calls change only the hash. Playwright returns `null`. G456 reads `navNonce = null` and fails `nonce-nav-header`.

Live split:

- 11/75 `nonce-nav-header` PASS: first route of each shared page (light home, dark home) plus every new-context layout/font cell (9). Those are real document loads.
- 64/75 `nonce-nav-header` FAIL `actual: null`: later hash-only navigations on the two shared pages.

A same-document transition cannot invent a new Response. The document nonce already arrived on the first load. Landing copy, `#app`, and expected anonymous final routes still passed on those cells.

## Cause 2 — in-page HEAD `/` `ERR_ABORTED` classified as missing JS/CSS

### Static server HEAD implementation (correct)

G456 `serveHandler`:

```js
if (method === 'HEAD') {
  res.writeHead(200, headers)  // includes x-g447-h5-nonce
  res.end()
  return
}
```

Empty body, 200, nonce header. Node `staticMiss` stayed 0. `counts.static` 1012.

### Playwright page-network / in-page fetch (different layer)

G456 then asserted nonce again via in-page fetch:

```js
const res = await fetch('/', { method: 'HEAD', cache: 'no-store' })
return res.headers.get(headerName)
```

Live: `nonce-in-page-head` 75/75 PASS. The HEAD response that `fetch` observed carried nonce `1ad3ff62e7d1726f60ec642fe510c65e`.

At the same time Playwright `requestfailed` fired `net::ERR_ABORTED` for `HEAD /`. G456 `onFailed`:

```js
if (isStaticRequest(url, request.method())) {
  row.missingStatic.push({ method, path, reason })
}
// later:
if (row.missingStatic.length) failRow(row, 'no-missing-js-css', [], row.missingStatic)
```

`isStaticRequest` is true for `HEAD /`. Every cell therefore failed `no-missing-js-css` even though:

- the Node handler served HEAD
- in-page `fetch` got the nonce
- no JS/CSS path was in the dominant abort sample

Extra: some profile cells also recorded `GET /static/figma-profile-169-9356/imgGlow.svg` `ERR_ABORTED`. That is an image, not JS/CSS.

`requestfailed` on an in-page HEAD through a Playwright route intercept is not the static-server HEAD implementation.

## What G456 cleanup proved

PID identity worked. Chrome children 34890/34906/34905/34904/34903 were gone after `browser.close()`. Port 18183 free of this process. Missing `process()` was not turned into a fake cleanup PASS.

## G462 rules (candidate; live matrix NOT_RUN here)

1. Classify `page.goto` as `document-load` | `same-document-hash` | `missing-document`. Never invent a Response.
2. Document load: require nonce header on the actual Response, plus index SHA-256 and full-tree fingerprint.
3. Hash-router transition: inherit the verified document nonce; validate `finalRoute` + visible UI.
4. Prove server HEAD with a fake `req`/`res` against `serveHandler` (no listen). Fail closed on missing nonce, HEAD body/status, or pin/tree mismatch.
5. `no-missing-js-css` only for GET `.js`/`.css` failures. HEAD `/` abort is `page-network-head-probe`. Aborted SVG is `static-aborted-non-js-css`.
6. Public login/register/forgot preserved. 33 requested vs observed final recorded. Protected anonymous redirect to login is not authenticated PASS.
7. Abort auth/business writes. No fulfill / fake auth / storage injection.
8. Keep Playwright Browser.close + OS descendant identity. Durable FAIL+cleanup on early exception.

G462 `--run` is for Root later. This session does not bind 18183 or launch Chrome.
