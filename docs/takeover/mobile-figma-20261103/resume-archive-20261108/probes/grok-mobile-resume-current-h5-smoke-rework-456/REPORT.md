# G456 rework of G451 guarded anonymous H5 smoke — prepared, not run

Root reviewed G451 before live. This session did **not** run the G451 candidate and did **not** bind 18183 or launch Chrome. G451 files are unchanged. `--run` is for one serialized Root runtime later.

Offline prepare **PASS**. Offline fixtures **PASS**. Runtime smoke **NOT_RUN**.

## Exact commands (this session)

```bash
OUTPUT=/tmp/grok-mobile-resume-current-h5-smoke-rework-456
node --check "$OUTPUT/run-current-h5.mjs"                 # exit 0
OUTPUT="$OUTPUT" node "$OUTPUT/run-current-h5.mjs"        # prepare only
OUTPUT="$OUTPUT" node "$OUTPUT/run-current-h5.mjs" --offline-fixtures
```

Root later, under the serialized 18183 lease:

```bash
OUTPUT=/tmp/grok-mobile-resume-current-h5-smoke-rework-456
node "$OUTPUT/run-current-h5.mjs" --run
```

Do not run `/tmp/grok-mobile-resume-current-h5-smoke-451/run-current-h5.mjs --run`.

Direct node (no `--run`) never listens, never launches Chrome, never sends HTTP to 18183. `--offline-fixtures` uses a fake Browser object and injected process tables. Collision on `--run` fails with exit 3. No port increment. No kill of foreign PIDs.

## G451 defect (Playwright 1.63, from checkout types + client)

Exact G451 line:

`ownership.browserPid = browser.process()?.pid || null`

That expression **calls** `process()` first; `?.pid` is on the return value. `playwright-core@1.63.0` `export interface Browser` (types `types.d.ts` 11018–11789) methods: `addListener`, `bind`, `browserType`, `close`, `contexts`, `isConnected`, `newBrowserCDPSession`, `newContext`, `newPage`, `off`, `on`, `once`, `prependListener`, `removeAllListeners`, `removeListener`, `startTracing`, `stopTracing`, `unbind`, `version`. **No `process()`.**

`process(): ChildProcess` is on `BrowserServer` (line 20429) and `ElectronApplication` (line 19102). `chromium.launch()` returns `Browser` (`client/browser.ts` class `Browser2`); `chromium.launchServer()` returns `BrowserServer`.

Offline fake Browser with no `process` method: `browser.process()?.pid` throws `TypeError: browser.process is not a function` (caught only inside the fixture probe). G456 never assigns ownership from that call.

`terminateOwn(pid)` in G451 sent SIGTERM by raw PID after `kill(pid, 0)` with no start-time/argv identity.

G451 `finally` closed browser/server; the durable FAIL+cleanup receipt with `failedStage` was missing when `process()` threw before navigation.

## G456 ownership

1. Snapshot OS descendants of this Node pid **before** `chromium.launch()`.
2. Launch via the existing ui-login Chrome-for-Testing / `channel: 'chrome'` loader.
3. Inspect `typeof browser.process` (live path does not call it).
4. Snapshot descendants **after** launch. Keep only Chrome-family children that were absent before. Identity = `pid|ppid|startTime|command`.
5. `browser.close()` first.
6. Revalidate leftovers against that identity. SIGTERM only on exact match, immediately re-checked. Never SIGKILL. Never kill a foreign or reused PID. Never kill self.
7. If identity cannot be established: send **no** manual signal and **fail closed** with `resource-unreleased` evidence. Missing `process()` is recorded; `passBecauseProcessMissing` stays **false**.
8. `finally` always writes `run-receipt.json` and `cleanup-receipt.json`, including exceptions before the matrix, with the exact `failedStage`.

## Pins (frozen G447 H5) — retained

Verified live against freeze `dependency-447-reviewed/h5`.

| pin | value |
|---|---|
| realpath | `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/dependency-447-reviewed/h5` |
| index SHA-256 | `7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8` (1419 bytes) |
| tree fingerprint | `f2ab7809b9d08d9bc8e342314e12c0b16d09628cfab62351390dd21e5f11740e` |
| files | 797 (102 assets + 694 static + index) |
| JS entry | `/assets/index-J7t0zLiz.js` |
| serve | `127.0.0.1:18183` exclusive |
| nonce header | `x-g447-h5-nonce` |
| pages.json | SHA-256 `949f390c7c3c8b127c980a0f53fc61e3e54459fdf4169bbb1597b065d9dc6518` |

`--run` re-hashes index **and** the full tree before and after.

## 33 requested routes vs observed final

Same 33 `pages.json` paths as G447/G451. Design `PAGES.md` set equals pages.json. Public 5 / protected 28. Protected anonymous expected **final** route: `pages/login/login`. Requested vs final are separate fields. **Do not call 33 authenticated pages passed.**

## Exact matrix denominator

**75 navigations** if `--run` completes:

- 33 requested routes × light/dark × phone 390×844 = **66**
- public login/register/password-reset × widths 320 and 768 = **6**
- same 3 pages × 200% font at 390 = **3**

Requested-route denominator remains **33**. Auth/business requests are aborted (`route.abort('blockedbyclient')`); no fulfill, token, or cookie injection. Public sanitized screenshots only. Budget ≤180s.

## Offline fixtures (this session, exit 0)

| fixture | result |
|---|---|
| fake Playwright Browser with **no** `process` | capture via descendants, G451 expression throws TypeError, `playwrightProcessMethodUsed=false`, cleanup PASS because owned Chrome was **gone** after `close()`, `passBecauseProcessMissing=false` |
| PID reuse / mismatch (pid 4242, start T1 Chrome vs T2 unrelated) | FAIL `cleanup-fail-closed`, signal **refused**, kill count 0, `resourceUnreleased=true` |
| thrown navigation before matrix | durable `run-receipt` + `cleanup-receipt` status FAIL, `failedStage=navigation`, code `NAVIGATION_THROWN_BEFORE_MATRIX`, browser closed |

## Offline results

| check | result |
|---|---|
| `node --check run-current-h5.mjs` | exit 0 |
| `node run-current-h5.mjs` (prepare) | exit 0 |
| H5 index + tree vs pins | match |
| pages.json 33 unique = PAGES.md set | true |
| playwright-core 1.63.0 Browser declares `process()` | false |
| BrowserServer / ElectronApplication declare `process()` | true / true |
| Chrome for Testing 1248/1243/1234 | all exist |
| bind / browser | false / false |
| lsof 18183 after prepare and fixtures | no listener |
| `--offline-fixtures` | exit 0 |
| G451 `--run` / G456 `--run` | **NOT_RUN** |

## G451 preserved (byte match)

| file | sha256 |
|---|---|
| `/tmp/grok-mobile-resume-current-h5-smoke-451/run-current-h5.mjs` | `c1957ed27a468b5ee0a6c5afe60afa8b2b627c599a9dbb539194d5cc9cb3244a` |
| `/tmp/grok-mobile-resume-current-h5-smoke-451/pins.json` | `99ef1e1d0d2df14204b5cfc8f58ceb015800cd92f467026a9ca05c83b6b04ad2` |
| `/tmp/grok-mobile-resume-current-h5-smoke-451/prepare-receipt.json` | `8a332419f8307ff3a3e89bc11424997e65f95fe07c9be70a5afe58d65baec093` |

## G456 receipts

| file | sha256 |
|---|---|
| `run-current-h5.mjs` | `ffb2c6614b0d2a8e96e026afc76bfba258e71a3d7f171ccd7b9e1cfba54500d0` |
| `pins.json` | `497229a1577eff0db11dc8799bf4b1192fc6187f846682eda6eb50e7625a5e6e` |
| `prepare-receipt.json` | `d447d260b641612f570dec1339a5e977f1703a3348420200645c915eed312cb6` |
| `offline-fixtures-receipt.json` | `a5a8e2330e228f4694ac281129871d098da5c966c98f13815478048581f65244` |
| `offline-fixtures/fake-browser-no-process/run-receipt.json` | `d4f4b2e8d92b169ca9279a0f31dd89068e6ff944bf824f65fd5d4699df7fc29a` |
| `offline-fixtures/fake-browser-no-process/cleanup-receipt.json` | `f9c880b978b427cc10596b7ee96081336b4e35a1ee1127d3079082301ed96504` |
| `offline-fixtures/pid-reuse-mismatch/run-receipt.json` | `a77fd5b83c15fb664bc6e8b0c54f4b1700dbdaa63a7148ba72bfa97aa19157a4` |
| `offline-fixtures/pid-reuse-mismatch/cleanup-receipt.json` | `62c9f5b4a4fc284e89350d7612f7705286d6c0656b6bf4de835a5ecc20f4b5fd` |
| `offline-fixtures/thrown-navigation/run-receipt.json` | `77f0194ddff7d0ea57c86b8ff6d8e59eb53830fd015c2bf6def66055019f3172` |
| `offline-fixtures/thrown-navigation/cleanup-receipt.json` | `6dc4e4cb355d9d11097e969b9824264c642b3dad1ae969a18bf0ec4d76cece64` |

## NOT_RUN

business · real-device · native · performance · Figma signoff · credential submission · authenticated pages · G451 `--run` · G456 `--run` browser smoke

No product, Git, install, module, global-settings, subagent, Codex, or DSH changes. G453 remains the audit-source owner in this checkout. Checkout was not written.
