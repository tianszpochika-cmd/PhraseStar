# G455 response-collection diagnosis of G446 attempt-not-one — PREPARED, NOT RUN

Root ran the G446 candidate once. Preflight passed. Observer FAILED `attempt-not-one` with a **continued** POST and **null** response status. This session read the actual receipts and the G280/G416/G446 route-response composition. The observer wait treats `route.continue()` as the collected attempt. That collection gap is proven. The Gateway/Assessment HTTP outcome is not proven. G455 waits the existing 15s bound for status or `requestfailed`, records sanitized diagnostics, and reads owner DB counts on observer failure. Success oracles are unchanged. No product source patch. No live runtime.

Directory: `/tmp/grok-mobile-resume-reading-response-diagnosis-455`

On macOS this is the same directory as `/private/tmp/grok-mobile-resume-reading-response-diagnosis-455`.

## Actual G446 runtime

Receipts:

- `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/reading-446-root/runtime-receipt.json`
- `INDEPENDENT-RELEASE.json` result `FAIL_ATTEMPT_POST_NO_OBSERVED_RESPONSE`, ports 13306/18070/18087/18088/18089/18091/18183 free, owned label absent
- `EXIT.json` exit 1, `timedOut` false, 2026-11-08T01:04:42Z

| counter | value |
| --- | ---: |
| abortedWrites | 0 |
| attemptPosts | 1 |
| attemptWrites | 0 |
| choiceCount / choiceGesture | 1 / click |
| practicePosts / practiceGets | 1 / 1, both 200 |
| attemptStatus | null |
| savedReceipt / feedbackVisible | false / false |
| continued | 21 |

`observerFailure.attemptProbe.closed[0]`: type `attempt-post`, disposition `continue`, method `POST`, host `127.0.0.1`, pathShape `/api/v1/assessment/sessions/{session}/attempts`, reason null, **status null**.

Completed stages through `gates`. `failedStage` `observer`. Session readback did not run. `h5Proof` false. Learning 18090 stayed down. `dialedAssessment` false.

## Proven composition

Expected genuine POST (compiled B139 G351 pin `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`):

- `B10ExerciseCard` emits `{selectedOptionKeys:[l]}` unless disabled
- `ke(e)` calls `G.submitAnswer`
- `submitAssessmentAnswer` POST `/assessment/sessions/{id}/attempts` with `Idempotency-Key`
- Gateway origin `http://127.0.0.1:18070`, query none

G280 frozen: POST `/attempts` is aborted (`attempt-write-closed`). `page.on('response')` attaches `row.status` from `pending.get(method + " " + response.pathname)`. `practiceTasks` are only session-create POST and session GET. No `requestfailed` listener. `settlePractice` races `Promise.all(practiceTasks)` against 15s.

G416/G446: first matching POST `/attempts` is continued, queued on `pending.get(method + " " + request.pathname)`, `attemptContinued = 1` **before** `route.continue()`. Wait loop:

```
while (now < bound && attemptContinued !== 1) sleep 100
await settlePractice()
require attemptRow.status === 200 && attemptSha256
```

`attemptContinued` is set at intercept. The 15s bound never waits for an HTTP status. `settlePractice` returns immediately when the earlier practice create/get tasks are already done. `attemptFacts` is pushed only after a response event. G280 matches pending with **response.url** pathname; the route queues **request.url** pathname.

That control flow is sufficient to produce this receipt: continue one POST, status null, opaque `attempt-not-one`, no replay, no saved receipt.

Practice create/read on the same page already collected 200 because the UI wait for the question happens after that POST, which is long enough for `page.on('response')` to fire and push `practiceTasks`.

Timeouts in source: observer deadline 120s, attempt bound 15s, settle 15s, Playwright default 20s, G387 HTTP 12s, runner observer guard 150s. EXIT was not an outer timeout.

## Unproven

These are **not** marked proven:

- Gateway or Assessment returned 200 / 4xx / 5xx
- Playwright `requestfailed` (timeout, abort, connection)
- `response.url` pathname diverged from `request.url` (redirect or trailing slash)
- `browser.close` aborted an in-flight POST after `finish()`
- product feedback-unmount
- assessment/content server failure

G455 does not invent a server or product conclusion. It collects the missing facts inside the existing 15s bound.

## Exact G455 changes

Observer (`reading-practice-h5.cjs`), derived from frozen G280 with the G416/G446 continue-one composition:

- After `attemptContinued === 1`, keep waiting the **same** 15s bound until the attempt-post row has an integer status or `attempt-request-failed`.
- After `attemptReplayContinued === 1`, keep waiting the **same** 8s replay bound until the replay row has an integer status or `attempt-request-failed`. G446 never reached replay; this is the same wait composition, not a new longer wait.
- `page.on('requestfailed')` matches pending by request pathname; class is `timeout|aborted|connection|net-error|other|unknown`. No raw error text.
- Pending attach uses `request.url()` pathname, then a session-tail fallback if the continue row still has null status.
- Non-200 bodies: `bodyShape` `json|empty|html|other` and a sanitized `errorCode` (`^[A-Za-z][A-Za-z0-9._-]{0,39}$`, max 40). No HTML, tokens, or stems stored.
- Fail reasons: `attempt-request-failed`, `attempt-response-missing`, `attempt-not-200`, plus the existing leak/body/key/`attempt-not-one`.
- Probe adds `lastStatus`, `bodyShape`, `errorCode`, `requestFailedClass`, `matcher`.
- One visible `.b10-option` click remains the submit. `feedback-not-rendered` stays. Same-key replay still runs only after a saved 200 + `attemptSha256`. G280 continue-one old needle stays the five-line abort.

Runner: identity MB455, path `grok-mobile-resume-reading-response-diagnosis-455`, docker suffix `20261106`. Reject leftover 314/360/387/399/403/416/446. On observer failure, `ownerFactsOnFailure` reads assessment-owner counts only (`session_all`, `session_in_progress`, `session_assessed`, `attempts`, `checkpoints`, `outbox`, `answers_len_sum`). Query errors become `{ok:false,reason:owner-facts-unavailable}` and do not replace the observer reason.

`response-classifier-offline.cjs` is the offline case file for the classifier. It does not launch Chrome. 24/24 cases passed, including G446 receipt → `attempt-response-missing`, `ERR_TIMED_OUT` → `timeout`, request-vs-response trailing-slash mismatch, and success still mapping 200 without a saved sha to a non-success reason.

B139/G351 index pin stays `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. No new product dependency. Frozen G314/G280/G360/G387 pins unchanged. Frozen G446 is a provenance pin, unread-write.

## Lease 455

Canonical directory: `/tmp/grok-mobile-resume-reading-response-diagnosis-455`. Docker label `cloudstudy.qa.mobile-resume-reading-response-diagnosis-455-20261106`. Container `cloudstudy-mobile-resume-reading-response-diagnosis-455-20261106`. Scratch prefix `cloudstudy-mobile-resume-reading-response-diagnosis-455.`. Hook `MB455_READING_LIVE_HOOK`. Run id `MB455_RUN_ID`. Kind `MB455`. Credential `mb455-{runId}@example.invalid`, password prefix `Mb455!`.

Ports: MySQL 13306, Gateway 18070, IAM TLS 18087, Learner 18088, Content 18089, Assessment 18091, H5 18183. Learning 18090 `UNTOUCHED`. Article 88061, item 88062, `reading.bind.b9`.

## Preserved originals

Unread-write. Frozen G446 hashes (live `/tmp/grok-mobile-resume-reading-attempt-446` still matches):

| file | SHA-256 |
| --- | --- |
| `run-reading-owner.py` | `675691c978dc8054dcd6da24af521a461c04c8aa1b74f28fe9f11ed55970fd35` |
| `reading-practice-h5.cjs` | `223eb8751d2d4af399fac9534cc3a3dfc21fa498822512d8892f837ec7651702` |
| `reading-live-hook.mjs` | `bf6d7951ec74bbcfc1dbfc4500aa7fe48c968753f3c0061e64501f17d311e0c6` |
| `pins.json` | `365aba8131fc88a711d594dde52e93d38c82f20a521a107c85ea723ac4f52def` |
| `REPORT.md` | `a2d69d113bfc11e9df5a569e4ff2ff6c5dd4c6ef0ee8cfdddd11fb840e1aad21` |

G446 root receipts and G446 live `/tmp/grok-mobile-resume-reading-attempt-446` were not written. Original 403, frozen 416/403, and product source were not written.

## G455 candidate hashes

| file | SHA-256 |
| --- | --- |
| `run-reading-owner.py` | `ef8b36ca38af0f4cc988c1331b2d907e1fe7cbd232274beb1dc5b1cc1aeed683` |
| `reading-practice-h5.cjs` | `dcb34e5614ac06b0ff2f21c6eb6104be3bd3993174c0b6880032e436d2c801ae` |
| `reading-live-hook.mjs` | `21c37a48420df079c8c898207b79ab03f22cda1d9d0e17211a9bf67368182873` |
| `pins.json` | `dedaa8ec62da2534bc82913dea27bdaac9d1e46411ceb5c4eddec308e3d02795` |
| `DIAGNOSIS.json` | `43594e6a209c70f30955915d4b7c05410e6b2a5ac9e892cb0126500475851796` |
| `response-classifier-offline.cjs` | `4810a3bc3b569c242b3c1194bd5630f586cd5638cc7c3dab9fdd7b6bba700353` |

Frozen B139 vs new-deps provenance: B139/G351 H5 index remains `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. New files in this directory are the G455 observer/runner/hook/pins/classifier/diagnosis only. No product module, JAR, or H5 rebuild.

## Actual checks vs NOT_RUN

Python 3.12.15 offline verifier 2026-11-08: **PASS**.

| check | result |
| --- | --- |
| runner AST | PASS |
| `node --check` observer/hook/classifier | PASS |
| patched inner observer `node --check` | PASS, 106631 bytes |
| classifier cases | 24/24 |
| `require_observer_text` | PASS |
| G314 `transform` uniqueness | PASS, leftover `[]`, `MB455` present |
| derived docker label | `cloudstudy.qa.mobile-resume-reading-response-diagnosis-455-20261106` |
| derived `owner_facts_on_failure` | present |
| derived attempts 1 / attempts 0 | true / false |
| G314 path count / leftover name | 2 / 3 |
| G280 five-line abort needle | 1 |
| FORBIDDEN on body / on facts | false / true |
| `feedback-not-rendered` | kept |
| hook disk matches `hook_text(G314)` | true |
| patch requestfailed / wait status / replay wait / fallback / request-path pending | true |
| frozen G446 hashes | unchanged vs pin |
| live `/tmp/grok-mobile-resume-reading-attempt-446` | byte-identical to frozen G446 |

NOT_RUN: live owner, browser click, continued POST collection, saved receipt, replay, MySQL session readback, port lease, `--preflight-only`.

## Missing runtime / DoD

Root owns one later serialized lease. Still required for signoff: one continued POST with observed status 200, `attemptSha256`, saved receipt and feedback DOM, same-key replay after that save, `ASSESSED` / attempts 1 / outbox 3. `feedback-not-rendered` remains a product-bug oracle if that path is reached. Do not add a second submit CTA. Do not fulfill auth or business routes.

## Exact safe validation command

This job already ran the AST, `node --check`, classifier, transform, and patched-source syntax checks. Root later owns:

```
python3.12 -c 'import ast; ast.parse(open("/tmp/grok-mobile-resume-reading-response-diagnosis-455/run-reading-owner.py", encoding="utf-8").read())'
node --check /tmp/grok-mobile-resume-reading-response-diagnosis-455/reading-practice-h5.cjs
node --check /tmp/grok-mobile-resume-reading-response-diagnosis-455/reading-live-hook.mjs
node /tmp/grok-mobile-resume-reading-response-diagnosis-455/response-classifier-offline.cjs
python3.12 /tmp/grok-mobile-resume-reading-response-diagnosis-455/run-reading-owner.py --preflight-only
python3.12 /tmp/grok-mobile-resume-reading-response-diagnosis-455/run-reading-owner.py
```

`--preflight-only` and the no-arg command start the owned lease. Do not run them until Root serializes one live attempt.
