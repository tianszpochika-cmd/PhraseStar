# G451 guarded anonymous H5 smoke — prepared, not run

**This session did not bind 18183 and did not launch a browser.** Root occupies that port for G444 under a serialized lease. `--run` is for Root later.

Offline prepare **PASS**. Runtime smoke **NOT_RUN**.

## Invocation

```bash
OUTPUT=/tmp/grok-mobile-resume-current-h5-smoke-451
node "$OUTPUT/run-current-h5.mjs"          # prepare/check only
node "$OUTPUT/run-current-h5.mjs" --run    # Root lease: listen 127.0.0.1:18183 + Chrome
```

Direct node (no `--run`) never listens, never launches Chrome, never sends HTTP to 18183. Collision on `--run` fails with exit 3. No port increment. No kill of foreign PIDs.

## Pins (frozen G447 H5)

Verified live against freeze `dependency-447-reviewed/h5` before writing the receipt.

| pin | value |
|---|---|
| realpath | `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/dependency-447-reviewed/h5` |
| index SHA-256 | `7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8` (1419 bytes) |
| tree fingerprint | `f2ab7809b9d08d9bc8e342314e12c0b16d09628cfab62351390dd21e5f11740e` |
| files | 797 (102 assets + 694 static + index) |
| JS entry | `/assets/index-J7t0zLiz.js` |
| serve | `127.0.0.1:18183` exclusive |
| nonce header | `x-g447-h5-nonce` (generated at `--run`, checked on document response and in-page `HEAD /`) |

`--run` re-hashes index **and** the full tree before and after. Same index can point at changed chunks; tree mismatch fails.

## 33 requested routes

Source: checkout `apps/mobile/src/pages.json` (SHA-256 `949f390c7c3c8b127c980a0f53fc61e3e54459fdf4169bbb1597b065d9dc6518`). Design list `docs/design/mobile-uispec-v2/PAGES.md` has the **same 33 paths** (order differs). Public 5 / protected 28 from `apps/mobile/src/auth/navigation.ts`.

Protected anonymous expected **final** route: `pages/login/login`. Public stays on itself (`欢迎回来` / `创建账号` / `忘记密码` / `暂时无法确认访问状态` / `分享的学习报告`). Requested vs final are recorded as separate fields. **Do not call 33 authenticated pages passed.**

## Exact matrix denominator

**75 navigations** if `--run` completes:

- 33 requested routes × light/dark × phone 390×844 = **66**
- public login/register/password-reset × widths 320 and 768 = **6**
- same 3 pages × 200% font at 390 = **3**

Requested-route denominator remains **33**. Layout extras are not extra official routes. No skipped check is marked PASS.

## Loader

Existing observer pattern from `apps/mobile/tests/ui-login.e2e.cjs` `launchBrowser`: Playwright 1.63.0 `chromium.launch` with Chrome for Testing 1248/1243/1234, then `channel: 'chrome'`. Prepare resolved playwright at checkout `node_modules/.pnpm/playwright@1.63.0/...`. All three Testing binaries exist. System Chrome exists as last fallback. **Not launched this session.**

## Guardrails in `--run` (not executed here)

- Static GET/HEAD from the frozen realpath only; nonce header on those responses.
- Playwright `route.abort('blockedbyclient')` for every nonstatic request (other origins, API, POST, websocket). Counts only; no bodies; no fulfill/token/cookie injection.
- Theme `localStorage ef.theme` is appearance only (same key as `mobile-experience.e2e.mjs`); not a credential.
- Public sanitized screenshots only (login/register/reset; inputs cleared). Protected pages are not saved.
- `finally`: `browser.close()`, `server.close()`, SIGTERM **own** browser PID if it remains, wait until **our** PIDs have released 18183. Foreign listeners are reported, not killed.
- Budget 180s.

## Offline results (this session)

| check | result |
|---|---|
| `node --check run-current-h5.mjs` | exit 0 |
| `node run-current-h5.mjs` (prepare) | exit 0 |
| H5 index + tree vs pins | match |
| pages.json 33 unique = PAGES.md set | true |
| playwright.chromium.launch | present |
| Chrome for Testing 1248/1243/1234 | all exist |
| bind / browser | false / false |
| lsof 18183 after prepare | no listener |
| `--run` | **NOT_RUN** |

Prepare-time lsof showed no 18183 holder. This session still did not bind. Root’s G444 lease remains respected.

## NOT_RUN

business · real-device · native · performance · Figma signoff · credential submission · authenticated pages · `--run` browser smoke

## Receipts

| file | sha256 |
|---|---|
| `run-current-h5.mjs` | `c1957ed27a468b5ee0a6c5afe60afa8b2b627c599a9dbb539194d5cc9cb3244a` |
| `pins.json` | `99ef1e1d0d2df14204b5cfc8f58ceb015800cd92f467026a9ca05c83b6b04ad2` |
| `prepare-receipt.json` | `8a332419f8307ff3a3e89bc11424997e65f95fe07c9be70a5afe58d65baec093` |

No product, Git, install, subagent, Codex, or DSH changes. Checkout dirty set is still the prior G447 six files only.
