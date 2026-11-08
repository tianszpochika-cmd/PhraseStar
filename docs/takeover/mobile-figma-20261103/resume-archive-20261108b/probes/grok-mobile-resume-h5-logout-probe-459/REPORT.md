# MB-005 IAM TLS logout H5 probe (G459)

Job `MB005-H5-IAM-LOGOUT-459`. Writable `/tmp/grok-mobile-resume-h5-logout-probe-459`. Live `NOT_RUN`. Preflight `NOT_RUN`. This session started no Docker, JVM, MySQL, IAM, Gateway, Chrome, or listener.

## G457 interrupted preparation, resumed without replay

G457 checkpoint `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/grok/resume-20261108-mobile-h5-logout-live-candidate-457.checkpoint.json` records `exit_code` 130, `session` null, finished `2026-11-08T01:28:19.580730+00:00`. Runner log matches. `/tmp/grok-mobile-resume-h5-logout-live-candidate-457/REPORT.md` is absent. Lease receipt, preflight, and scratch are absent.

G457 already built an immutable H5 at `OUTPUT/h5` (`build-h5.exit` 0, compiler 4.81 vue3) and wrote index/tree/source provenance. B156 five approved mobile files were already copied. This job copied probe text only, rebound identity to G459, and pinned that same H5. G457 bytes were left in place.

`end.sessionId` remains null. The checkpoint supplies no IAM session identifier, and none is recorded here.

## H5 provenance, verified this session

Independent recomputation of `/tmp/grok-mobile-resume-h5-logout-live-candidate-457/OUTPUT/h5` matches G457 manifests.

| pin | value |
| --- | --- |
| index.html sha256 | `8233e1edfaf8bb40489c80ce068ccc9abd6901a4fbb828bc012e999eaa91e7a3` (1419 bytes) |
| file count | 797 |
| tree fingerprint | `4ce625011733acc0a63c2ae08b0911270498f60eb0c0d6106717bf88ebc752dc` |
| tree-manifest.txt sha256 | same as tree fingerprint (sorted `path TAB sha256 TAB size` lines) |
| rejected indexes | B139 `706fffb751…ae32`, B116 `94047adf…4520`, G447 `7622ab9c…a9d8` |

Source provenance remains G457 `OUTPUT/source-provenance.json`: checkout HEAD `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db` (git-HEAD-only; not integrated `dev@84f0dead`), composition `ed6a1e57` + B153/G447 dependency files + B156 five mobile files, IAM controller test not copied.

Worktree composition hashes still match those pins (read-only). `IamLogoutCookieClearControllerTest.java` is still absent in this checkout. G461 owns audit source; those files were left untouched.

Frozen bundle still contains IAM base `https://127.0.0.1:18087/api/v1` in `gateway.DnJL32t8.js`, `/auth/logout` on the H5 session client in `session.DQ2Luqx0.js` (`$(){return s()?R:_}` with native Gateway `R` and H5 IAM `_`), adult copy, and forbidden-exit host classes. Identifier `mobileIamBearerClient` is minified away.

## G444 cookie failure, unchanged

Root receipt `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/forbidden-444-root/lease-receipt.json` remains FAIL `cookie-not-cleared` with `clearOverHttps: false`, `storedBefore: true`, `jarRemains: true`, `cookieCleared: false`. Logout in that run was Gateway HTTP. That receipt is immutable evidence.

B156 H5 logout and current-session revoke target IAM TLS `https://127.0.0.1:18087` with in-memory bearer and `withCredentials`. This probe allows one current-session `POST /api/v1/auth/logout` on that origin with bearer plus refresh cookie and no `X-Auth-Transport`. Gateway logout, `/auth/sessions/{id}/revoke`, learning/consent/target writes, fulfill, cookie injection, and `clearCookies` stay blocked.

Cookie oracle: stored live `yuxuexing_refresh` at `/api/v1/auth` before click; awaited `Set-Cookie` empty value, `Max-Age=0`, past `Expires`, matching path, `Secure`, `HttpOnly`, `SameSite=None`, `Partitioned`, over HTTPS; jar absent after. Header-only or family `REVOKED` is insufficient. Flow still requires one adult denial, principal readback `RESTRICTED`/`REJECTED`, single logout `200` `REVOKED` `CURRENT_SESSION_AND_TOKEN_FAMILY`, and login landing `欢迎回来`.

Offline matcher reconstructs the G444 HTTP-clear + remaining-jar tuple as `cookie-not-cleared`, and a full IAM HTTPS clear + absent jar as `cookieCleared`.

## G459 identity

| item | value |
| --- | --- |
| job | `MB005-H5-IAM-LOGOUT-459` |
| container | `cloudstudy-mobile-h5-logout-459` |
| label | `cloudstudy.qa.mobile-h5-logout-459` |
| actor prefix | `g459-` / `G459!` (omitted from receipts) |
| H5 root | `/tmp/grok-mobile-resume-h5-logout-live-candidate-457/OUTPUT/h5` |
| nonce header | `x-mb004-static-qa` |
| ports | 13306, 18070, 18087, 18183 |
| IAM jar | `98f6b2d6b8c44de9d94f44bcf498d154f009c52faf4aa3615d2a9e513b390007` |
| Gateway jar | `7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1` |
| G378 probe | `3d83250d5fcea43c231007c85c2496ae12ac462143bdaba0ae41ae84b706d6d8` (12537 bytes) |
| rebind | frozen G393 `iam-only-lease.py` in memory |

Live cleanup stays fail-closed on this job's PIDs, label, and scratch only: tail process-group identity, Chrome children of that tail or orphans carrying this marker, Java/probe recount, container name+label+id, `reap_settled` (`remaining==0`, `unverified==0`, `signaled<=reaped`), ports 13306/18070/18087/18183 free, scratch removed. Foreign PIDs and other jobs' containers are left alone. Tail budget 180s. This session did not exercise that path.

## This session command exits

Python 3.12.15, Node v20.19.5.

| command | exit |
| --- | --- |
| `node --check forbidden-h5-observer.mjs` | 0 |
| `node --check h5-lease-tail.mjs` | 0 |
| `node --check pinned-static-nonce.mjs` | 0 |
| `node --check offline-checks.mjs` | 0 |
| `python3.12 -m py_compile forbidden-h5-wrapper.py` | 0 |
| `node forbidden-h5-observer.mjs` | 0 (`OBSERVER_PREPARED`, h5 not-started) |
| `node pinned-static-nonce.mjs` | 0 (`USAGE`, launched false) |
| `node h5-lease-tail.mjs` | 0 (`USAGE`, stdin-owned-lease) |
| `node offline-checks.mjs` | 0 (36/36) |
| `python3.12 forbidden-h5-wrapper.py --offline-only` | 0 (`status=OFFLINE reason=None`) |
| wrapper `--preflight-only` | `NOT_RUN` |
| wrapper live | `NOT_RUN` |
| H5 rebuild | `NOT_RUN` |
| browser / Docker / JVM / listener | `NOT_RUN` |

`lsof` on 13306/18070/18087/18183 after those commands recorded no LISTEN rows. Empty files are `lsof-*-after-*.txt`.

## Offline matcher/guard coverage (36)

Canonical G457 H5 prove; reject B139/B116/G447 index and B139 root; observer prepared; cookie matcher; allowlist; G444 HTTP clear with jar remaining; IAM HTTPS clear with jar absent; clear-header attributes; logout bearer+cookie shape; uni-button logout host and disabled host; adult/login classify; source bans (`route.fulfill(`, `addCookies(`, `clearCookies(`, `addInitScript(`, `localStorage.setItem`); G459 actor present and G457 actor prefix absent; tail imports G459 modules; wrapper identity and `--offline-only`; nonce pins G457 H5; IAM logout URL present; no `end.sessionId` in probe sources.

## Root live command

After review, one serialized run of `/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-h5-logout-probe-459/forbidden-h5-wrapper.py` (`--preflight-only` first if wanted). Do not run the G457 wrapper. Do not rebuild the H5.

Exit 0 is PREFLIGHT or OBSERVED with cleanup. Exit 2 is closed pin/argv/replay/scratch. Exit 1 is any other failure, including `cookie-not-cleared`. Observer pass with incomplete cleanup is a failed lease.

## Exact static and probe source pins

Immutable G457 H5 (served as-is):

| item | sha256 |
| --- | --- |
| `OUTPUT/h5/index.html` | `8233e1edfaf8bb40489c80ce068ccc9abd6901a4fbb828bc012e999eaa91e7a3` |
| H5 tree fingerprint (797 files) | `4ce625011733acc0a63c2ae08b0911270498f60eb0c0d6106717bf88ebc752dc` |
| `OUTPUT/source-provenance.json` | `db10abf1d455baa34f284c99c12e14e714208c1e9298b16faee7834ffe656ae8` |
| G457 wrapper original | `863c23444787f3c42ae72475c6ccc436af39fd79f519a39415e5a2d2c5e7ed61` |
| G457 observer original | `5bb94d95e9cac593a4c56513005a47ca53b48f026959775bc0a94a58d39b4c11` |
| G457 tail original | `6e39425d0c8e2516554e1fe01081037e787b08b3de8b7759cd5bb7088c597860` |
| G457 nonce original | `5dd844b7188ba016b1016a89a4b86f318c65da8b9d237002a90236826f1b9174` |

G459 rebound probes:

| file | sha256 |
| --- | --- |
| `forbidden-h5-wrapper.py` | `3da683e3d6c29bef45f5994408d02c769f79fd14f6132156ce35e148553a5e9b` |
| `forbidden-h5-observer.mjs` | `20c8281502e092bd1f886f0148a18634d30d01e16609dfe51a575b67f5ed82f1` |
| `h5-lease-tail.mjs` | `5599cf0dddd5af46581d0801dc04a9ba5f5c192d132a10d9de5219929f664df2` |
| `pinned-static-nonce.mjs` | `6065f129812b6648c5e5a19284faddef364b7ea36a74612761a52d04fa565891` |
| `offline-checks.mjs` | `036e116ebf1a8a5b7034732ed5dd52fd0cbe2422b7df2f40d3102e5597eb4aca` |
| `pin.json` | `f343cbed75636e3be770235ff12405c299e544db7578140bd9ee2f9d8ee11f12` |
| `offline-receipt.json` | `63b840f3b6766ac29211379bdcfff1d6220485251fa1a2134e0c1a106ddb6f42` |

Jars and G378 probe: IAM `98f6b2d6b8c44de9d94f44bcf498d154f009c52faf4aa3615d2a9e513b390007`, Gateway `7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1`, G378 `3d83250d5fcea43c231007c85c2496ae12ac462143bdaba0ae41ae84b706d6d8`.

Remaining file hashes: `hashes.json`. G457 copy-source record: `g457-immutable-pins.json`.

## Untouched

G457 OUTPUT/h5 and G457 probe originals (copy was outbound). G444/G435 receipts. Worktree product, dependency, and audit files. Integrated `dev@84f0dead`. Codex/DSH/git/index/provider/global config.
