# G462 STRICT anonymous H5 smoke — diagnosis + candidate, live matrix NOT_RUN

User resumed 2026-11-08. Root is supervisor. This session used Grok CLI only.

G456 live matrix remains **FAIL 75/75, cleanup PASS**. Those receipts are unchanged. G462 is a new runner on the immutable G447 H5. Live 75-cell smoke is **NOT_RUN**. Browser and listener were not started.

Offline prepare **PASS** (exit 0). Offline HTTP-free fixtures **PASS** 48/48 (exit 0). Syntax **PASS** (exit 0).

## Exact commands (this session)

```bash
node --check /tmp/grok-mobile-resume-h5-smoke-diagnosis-462/run-current-h5.mjs
# CHECK_EXIT:0

OUTPUT=/tmp/grok-mobile-resume-h5-smoke-diagnosis-462
node --input-type=module -e 'import { prepare } from "/tmp/grok-mobile-resume-h5-smoke-diagnosis-462/run-current-h5.mjs"; const r = await prepare(); ...'
# PREPARE_EXIT:0  bind:false browser:false

OUTPUT=/tmp/grok-mobile-resume-h5-smoke-diagnosis-462
node --input-type=module -e 'import { runOfflineFixtures } from "/tmp/grok-mobile-resume-h5-smoke-diagnosis-462/run-current-h5.mjs"; const { summary } = await runOfflineFixtures(); ...'
# FIXTURES_EXIT:0  ok:true failed:[] checkCount:48 bind:false browser:false liveRun:false
```

Default `node run-current-h5.mjs` (no flags) is prepare-only. This sandbox blocked that argv as a possible live run, so prepare and fixtures were imported. They call the same functions. `--run` was not passed.

Root later, under the serialized 18183 lease, one matrix:

```bash
OUTPUT=/tmp/grok-mobile-resume-h5-smoke-diagnosis-462
node "$OUTPUT/run-current-h5.mjs" --run
```

Do not run G451 `--run`. Do not re-run G456 `--run` as a substitute for G462. G457 is a different job.

## G456 live FAIL preserved (immutable)

| field | value |
|---|---|
| run | `.../resume-20261108/current-h5-456-root/run-receipt.json` SHA-256 `a6e1c403ff7dda758a3241bf96264367748ba6e9cf0591f3f1aef7ddaf4425bc` (286080 bytes) |
| cleanup | `.../cleanup-receipt.json` SHA-256 `1e0581e4704b402d2dd714cf1d7b953c889cf6f0af1ae473ae34371c0f6fec12` |
| EXIT | `{"exit": 1}` SHA-256 `3cf1bf40bdcbffa1d103602f6f30cd532b4eed2914b7c9e1be645aad52dc1795` |
| at | 2026-11-08T01:26:30.199Z, elapsed 9758 ms |
| summary | total 75, pass 0, fail 75, `failedStage: complete` |
| cleanup | `ok: true`, Chrome PIDs 34890/34906/34905/34904/34903 gone after `browser.close()` |
| ownership | `playwrightProcessMethodUsed: false`, `passBecauseProcessMissing: false` |
| tree | unchanged; static 1012, staticMiss 0, nonstatic 0 |
| G456 source | SHA-256 `ffb2c6614b0d2a8e96e026afc76bfba258e71a3d7f171ccd7b9e1cfba54500d0` matches frozen MANIFEST |

`/tmp/grok-mobile-resume-current-h5-smoke-rework-456/run-receipt.json` has the same SHA-256 as the Root copy.

## Diagnosis (two layers)

Full write-up: `DIAGNOSIS.md`.

### 1. Hash-only `page.goto` returns null — Playwright API, not a missing nonce

Playwright 1.63 `types.d.ts` 7740–7741: navigation to the same URL with a different hash succeeds and returns `null`.

G456:

```js
const navNonce = response ? response.headers()['x-g447-h5-nonce'] : null
```

Null became `nonce-nav-header` FAIL (`actual: null`) on 64/75 later hash-only cells. 11/75 document loads (first route of each shared page plus every new-context layout cell) had nonce `1ad3ff62e7d1726f60ec642fe510c65e`. Landing copy, `#app`, and expected anonymous finals still passed. A same-document transition has no new Response to invent.

Offline proof: `classifyPlaywrightNavigation(null, priorVerifiedDocument)` → `kind: same-document-hash`, `inventedResponse: false`, inherited nonce. `g456WouldFailNonceNav(null) === true`.

### 2. `HEAD /` `net::ERR_ABORTED` — Playwright page-network, not the static-server HEAD implementation

G456 `serveHandler` HEAD path: `writeHead(200, nonce headers); res.end()` empty body. Live `staticMiss=0`, `nonce-in-page-head` 75/75 PASS.

G456 `onFailed` treated every `isStaticRequest` failure as missing JS/CSS, including `HEAD /`. That filled `no-missing-js-css` on all 75 cells. Profile cells also recorded `GET .../imgGlow.svg` `ERR_ABORTED` (image, not JS/CSS).

The in-page `fetch('/', {method:'HEAD'})` both got the nonce and emitted Playwright `requestfailed`. That abort is a page-network / route-intercept artifact.

Offline proof (fake IncomingMessage/ServerResponse, no listen): live G447 handler HEAD `/` → 200, nonce present, body 0 bytes. POST `/` → 444. HEAD with body or 405 → `evaluateServerHead.ok === false`. `classifyRequestFailed(HEAD /)` → `page-network-head-probe`, `missingJsCss: false`. GET `.js` abort → `missing-js-css`. GET `.svg` abort → `static-aborted-non-js-css`.

## G462 policy (candidate)

- Actual document load (`page.goto` returns a Response): require nonce header + live index SHA-256 + full-tree fingerprint.
- Hash-router transition (`goto` returns null after a verified document): inherit that nonce; validate current `finalRoute` + visible UI; `inventedResponse` stays false.
- Null `goto` without a verified prior document: FAIL (`missing-document`).
- Real document missing nonce, server HEAD failure, wrong tree, or GET `.js`/`.css` abort: FAIL closed.
- Public login / register / forgot preserved. 33 requested routes recorded vs observed final. Protected anonymous landing on login is `protected-anonymous-redirect-not-authenticated-pass`, not an authenticated PASS.
- Abort auth/business writes. No fulfill, fake auth, token, cookie, or credential storage injection.
- Playwright `Browser.close()` + OS descendant `pid|ppid|startTime|command`. Never `browser.process()`. Durable `run-receipt.json` + `cleanup-receipt.json` on early exception.

H5 is frozen G447 `dependency-447-reviewed/h5`. G457 is out of scope.

## Pins (G447, verified this session)

| pin | value |
|---|---|
| realpath | `.../dependency-447-reviewed/h5` |
| index SHA-256 | `7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8` (1419 bytes) |
| tree fingerprint | `f2ab7809b9d08d9bc8e342314e12c0b16d09628cfab62351390dd21e5f11740e` |
| files | 797 |
| JS entry | `/assets/index-J7t0zLiz.js` |
| serve | `127.0.0.1:18183` exclusive |
| nonce header | `x-g447-h5-nonce` |
| pages.json | SHA-256 `949f390c7c3c8b127c980a0f53fc61e3e54459fdf4169bbb1597b065d9dc6518`, 33 routes, PAGES.md set equals |
| public / protected | 5 / 28 |

`--run` re-hashes index and the full tree before listen and after matrix.

## Exact matrix denominator (when Root runs `--run`)

**75 navigations**: 33 routes × light/dark × 390×844 = **66**, plus public login/register/reset-password × {320, 768, 200% font at 390} = **9**. Requested routes remain 33. Final routes are a separate field.

## Offline fixtures (HTTP-free, 48 checks)

| fixture | expected | actual |
|---|---|---|
| fake-browser-no-process | PASS, no `process()`, cleanup ok | PASS, `failedStage: complete` |
| pid-reuse-mismatch | FAIL closed, no kill | FAIL, `cleanup-fail-closed` |
| thrown-navigation | durable FAIL | FAIL, `failedStage: navigation` |
| document-missing-nonce | HEAD missing nonce FAIL closed | FAIL, `SERVER_HEAD_FAILURE`, `server-head-self-check` |
| wrong-tree | pin mismatch FAIL | FAIL, `pin-verify-before` |
| route-guard-js-error | GET `.js` abort FAIL | FAIL, `no-missing-js-css` |
| hash-route-legitimate | null goto inherits nonce | `same-document-hash`, `inventedResponse: false`, G456 would FAIL |

HEAD-with-body and HEAD 405 fail `evaluateServerHead`. Auth POST abort is `nonstatic-aborted`.

## NOT_RUN

- G462 live 75-cell matrix (`--run`)
- browser / Chrome launch
- `127.0.0.1:18183` listen
- business, real-device, native, performance, Figma signoff
- credential submission, authenticated pages
- G451 `--run`, G456 re-run, G457

Node printed `NO_COLOR` ignored because `FORCE_COLOR` is set. That is an environment warning, not a fixture failure.

## Checkout observation

G462 wrote only under `/tmp/grok-mobile-resume-h5-smoke-diagnosis-462`. `git status --porcelain` on the detached checkout still lists dirty app/package/lock files (admin-web, learner-web, mobile, official-site, auth tests, `pnpm-lock.yaml`). Those are outside this job (G453/other). G462 did not edit them.

## Outputs

| file | SHA-256 |
|---|---|
| run-current-h5.mjs | `22c3b1b1709484f073134654313aa3554e1acbf32c8fa767e5a58e69790c0c63` |
| pins.json | `37e9680883c8c03c0f63e53e1f1733f2441ff572f8197959b69b826270d6b99c` |
| DIAGNOSIS.md | `41d0f007076a83b9f9947a329e90f818f72b047e82c4c4c765a9c77371db08b4` |
| prepare-receipt.json | `64ee11ffb065edceb48e78e5bc22624bb74d348a8961a32857345d33684b474c` |
| offline-fixtures-receipt.json | `df507739902d3f1247908d1bfa0be8d437bc3c2745c4249330d899a212555382` |

`HASHES.json` is written after this report so it can include `REPORT.md`.
