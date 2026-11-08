# G446 probe repair of G416 attempt-not-one — PREPARED, NOT RUN

Root ran G416 once on 2026-11-08 after `--preflight-only` PASS. The observer FAILED `attempt-not-one` after one published-reading CHOICE click. This session diagnosed that failure from the actual observer counters, compiled B139 submit handlers, and the G416 request-body gate. It is a probe bug. The corrected candidate is this directory only. Original G416, frozen G416, and the actual FAIL_ATTEMPT_NOT_ONE receipt were not written. No product source, Git, Docker, JVM, Chrome, listener, or live business ran.

Directory: `/tmp/grok-mobile-resume-reading-attempt-446`

On macOS this is the same directory as `/private/tmp/grok-mobile-resume-reading-attempt-446`.

## Actual finding

Probe bug. G416 aborted the genuine first CHOICE POST because `attemptBodyVerdict` applied `FORBIDDEN_SNIPPETS` (`'"beta"'`, `'"Bee"'`, `'"Aye"'`, `'Owner stem'`) to the request JSON. Compiled B139 emits `{selectedOptionKeys:["beta"]}` on the first visible option click. That body is a real answer, not an article leak. The abort never continued, so `attemptPosts` stayed 0 and the wait timed out as opaque `attempt-not-one`.

Actual G416 observer counters from `resume-20261108/reading-416-root/runtime-receipt.json` (derived from the unchanged `runtime.log`):

| counter | value |
| --- | ---: |
| abortedWrites | 1 |
| attemptPosts | 0 |
| attemptReplays | 0 |
| attemptWrites | 0 |
| questionsClosed | 1 |
| practicePosts | 1 |
| practiceGets | 1 |
| readingLists | 1 |
| readingDetails | 1 |
| reading200 | 2 |
| syntheticFulfills | 0 |
| learningWrites | 0 |
| scoreWrites | 0 |
| legacyCreates | 0 |
| choiceCount | 1 |
| choiceGesture | click |
| postStatus | 200 |
| getStatus | 200 |
| postShape | expected |
| questionSame | true |
| sameSession | true |
| attemptStatus | null |
| savedReceipt | false |
| feedbackVisible | false |

`INDEPENDENT-RELEASE.json`: `RELEASED_INDEPENDENTLY_VERIFIED`, result `FAIL_ATTEMPT_NOT_ONE`, preflight `PASS_PYTHON312`, runnerPid 21598, ports 13306/18070/18087/18088/18089/18091/18183, `portsVerifiedFree` true, `ownedContainerReleased` true.

Why these counters are a body-abort, not an application miss:

- One CHOICE click happened (`choiceCount` 1, `choiceGesture` click). The option was not disabled: the G416 wrapper refuses a disabled `.b10-option`, and the click returned `clicked`.
- Compiled B139 would POST on that click. `B10ExerciseCard.CgmwYBi0.js` does `C.disabled||(N.value=l,T("answer",{selectedOptionKeys:[l]}))`. `pages-b2-practice-b2-practice.CnL1UD5o.js` does `async function ke(e){if(ie.value&&oe.value&&!re.value){re.value=!0;try{le.value=await G.submitAnswer(oe.value.exerciseId,e)}finally{re.value=!1}}}`. `b10-learning.D8oTzoUN.js` calls `v.submitAssessmentAnswer(...)`. `b10.BmqZhmeX.js` uses `sessions:"/assessment/sessions"` and `Idempotency-Key`. There is no second submit CTA.
- `attemptWrites` 0 means the abort was not G280 default `attempt-write-closed`. That reason would increment `attemptWrites`. `abortedWrites` 1 with `attemptWrites` 0 is an `excluded-write` abort whose reason is `attempt-body-rejected` / `attempt-key-rejected` / similar, which G416 then collapsed to `attempt-not-one`.
- `attemptPosts` 0 means no extra POST and no continued POST. Not a double-submit.
- `questionsClosed` 1 is the expected GET `/api/v1/reading/questions` abort (`reading-questions-closed`). It is not the attempt POST.
- Practice create/read stayed on Gateway 18070, status 200, same session, same question, contentVersionId 266101. The attempt row never continued, so `attemptStatus` stayed null. This is not a route/host mismatch on the practice client.
- G387 already scored the same first `optionIds[0]` with `OPTION_ID = /^[a-z][a-z0-9._:-]{0,63}$/` and `response: { selectedOptionKeys: [selected] }`. G387 does not apply `FORBIDDEN_SNIPPETS` to the request body. G416 original wrapper still contains one `FORBIDDEN_SNIPPETS... return 'rejected'` line inside `attemptBodyVerdict`. G251 fixture `CORRECT_OPTION` is `"beta"`, first visible option.

Root did not infer a feedback-unmount product bug. `savedReceipt` / `feedbackVisible` stayed false because the attempt never continued. `feedback-not-rendered` remains a live oracle. This lease does not loosen it.

No product source patch is proposed. The application submit path is the current CHOICE click.

## Exact changes in this directory

- `reading-practice-h5.cjs` drops `FORBIDDEN_SNIPPETS` from the attempt **request** body. It keeps `SESSION_LEAKS`, optionId `/^[a-z][a-z0-9._:-]{0,63}$/`, and `FORBIDDEN_SNIPPETS` on `attemptFacts` (response). `safeAttemptProbe(traffic)` emits `abortedWrites`, `attemptPosts`, and up to 8 closed rows of `{type, disposition, reason, method, status, host, pathShape}` only. `host` is `127.0.0.1` or null. No body, HTML, token, or article stem. The wait loop breaks on an abort reason starting with `attempt-` instead of always consuming 15s. Fail reason maps `attempt-body-rejected` / `attempt-key-rejected` / `attempt-leak` before opaque `attempt-not-one`, and attaches `attemptProbe`. Patched `/attempts` notes pass `host: url.hostname`. G280 `note()` copies that host. The G280 continue-one old needle stays the five-line abort (`tail === '/attempts'` POST abort `attempt-write-closed`), count 1 in frozen G280. One visible `.b10-exercise-card .b10-option` click remains the submit. `feedback-not-rendered` stays.
- `run-reading-owner.py` rebinds identity 446, rejects leftover 314/360/387/399/403/416 markers in derived G314 and the rewritten hook, keeps the G314 observer-gate needle `code != 0 or parsed.get("status") != "OBSERVED" or parsed.get("reason") != "published-practice"`, and redacts `attemptProbe` through `redacted_observer_failure` (count/status/host/pathShape/reason only).
- `reading-live-hook.mjs` is rebound to `MB446_READING_LIVE_HOOK` / `MB446_RUN_ID` / `mb446-reading-live-hook/1`. The runner still rewrites this file from frozen G314 before exec.
- `pins.json` names job `resume-20261108-mobile-reading-446`, kind `MB446`, source `/tmp/grok-mobile-resume-reading-attempt-446`. Frozen pin paths and SHAs are unchanged.

B139/G351 H5 index pin stays `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. G387 session facts stay `ASSESSED` / `attempts` 1 / `outbox` 3 / `state_version` 2. Learning 18090 stays `UNTOUCHED`. Same-key replay still runs only after a valid saved answer. No Learning consume, no API `route.fulfill`, no auth injection.

## Lease 446

Canonical directory: `/tmp/grok-mobile-resume-reading-attempt-446` (macOS `/private/tmp` is the same directory). Docker label `cloudstudy.qa.mobile-resume-reading-attempt-446-20261106` after the G314 name replace (the frozen runner keeps its 20261106 suffix). Container `cloudstudy-mobile-resume-reading-attempt-446-20261106`. Scratch prefix `cloudstudy-mobile-resume-reading-attempt-446.`. Hook marker `MB446_READING_LIVE_HOOK`. Run id env `MB446_RUN_ID`. Receipt kind `MB446`. Credential `mb446-{runId}@example.invalid`, password prefix `Mb446!`.

Five service JVMs stay IAM, Gateway, Learner, Content, and Assessment. Registered ports: MySQL 13306, Gateway 18070, IAM TLS 18087, Learner 18088, Content 18089, Assessment 18091, H5 18183. Learning 18090 stays in `UNTOUCHED`. No broker. No Learning consume claim.

Publication scope stays G360/G387: article 88061, item 88062, `reading.bind.b9`, owner snapshot `snap_reading_{version}`, numeric public snapshot id.

## Preserved originals

Unread-write. Live G416 matches frozen G416:

| file | SHA-256 |
| --- | --- |
| `run-reading-owner.py` | `da62bd56912c43454483f208d1b6d19b9a0d6dbe631a0bf5a1758fc2e773fbab` |
| `reading-practice-h5.cjs` | `954a3da9dba410803735ade0bacbeb3573be964ae9c2fa27f9112174317a5024` |
| `reading-live-hook.mjs` | `5263ad5c37c01b60214bae9f6184799091059db2d4fc9859bedce9b8be270f08` |
| `pins.json` | `3f21b9d46db0045cb9882c38ad3bba17bdb3e9e7fd409d5ac86ca893b53b5c3e` |
| `REPORT.md` | `613f98d72c907c536636cca360cdcd5884aad8a087a66bc35535891ec9c8c0a2` |

Actual failure remains `resume-20261108/reading-416-root/` (`runtime-receipt.json`, `runtime.log`, `INDEPENDENT-RELEASE.json`, `EXIT.json`, `LEASE.json`). Frozen G314/G280/G360/G387/G351 pins are unchanged.

## Actual checks vs NOT_RUN

Checked this session with Python 3.12.15 and Node v20.19.5. No service started.

- Frozen G314 path count 2, leftover name count 3, observer-gate count 1.
- Frozen G280 `/attempts` abort needle count 1. Wrapper still uses that exact `once()` old string.
- Wrapper: `FORBIDDEN` request-body reject absent; `FORBIDDEN` on `attemptFacts` present; optionId regex present; `safeAttemptProbe` present; `feedback-not-rendered` present; no second-submit locator as a click target.
- `python3.12` `ast.parse` of `run-reading-owner.py` succeeded.
- `node --check` of `reading-practice-h5.cjs` and `reading-live-hook.mjs` succeeded.
- Offline import of the 446 runner: `require_observer_text` PASS; `transform(G314)` PASS; `compile(derived)` PASS; `hook_text` PASS and matches the on-disk hook.
- Derived G314 contains MB446, docker label `cloudstudy.qa.mobile-resume-reading-attempt-446-20261106`, choice click, saved/feedback, `published-practice-scored`, attempts 1, outbox 3, `ASSESSED`, B139 index, `UNTOUCHED = (18090,)`, `redacted_attempt_probe`. It does not contain MB314/MB416/MB403, `"attempts": 0`, the frozen G280 observer path, `shell=True`, or `os.system(`.
- Node executed wrapper `patch()` only, then exited before `_compile` / Chrome. Derived observer bytes 100158. `forbiddenBody` false, `forbiddenFacts` true, `hasProbe` true, `hasHost` true, `earlyAbort` true, `mapBodyRejected` true, `continueAttempts` true.
- Original 416 live hashes equal frozen 416 hashes.

NOT_RUN:

- `--preflight-only` of the derived G314 owner (inspects Docker and ports and would rewrite hook/manifest)
- live owner runtime
- browser option click against Gateway
- continued attempt POST, saved receipt, score, same-key replay
- MySQL session readback (`ASSESSED`, attempts 1, outbox 3)
- port lease and cleanup

## Missing runtime / DoD

This job does not claim route or DoD signoff. One serialized Root lease still has to prove, on the fixed ports, with this 446 candidate:

- one genuine CHOICE click continues exactly one POST `/api/v1/assessment/sessions/{session}/attempts`
- saved receipt and feedback DOM (`[data-save-receipt]`, `[data-feedback-text]`)
- same Idempotency-Key replay after that saved answer, still one DB answer
- owner/version protected, status `ASSESSED`, `attempts` 1, outbox 3, `state_version` 2
- `h5Proof` true only for `published-practice-scored`

If the continued POST is 200 and the one-item panel unmounts before those nodes paint, the live reason is `feedback-not-rendered`. That remains a product bug until independently fixed. Do not change that oracle to pass.

If 446 still yields `attemptPosts` 0 with `closed[]` empty, that would be a later no-POST diagnosis (click handler / uni-button). Do not invent a second submit CTA.

## Remaining prerequisites

- One serialized runtime on the fixed ports above. Learning 18090 and Kafka 19092 stay down.
- Docker context `desktop-linux`, G314 MySQL image, IAM/Gateway/Learner/Content/Assessment jars and the G251 fixture.
- Fresh synthetic adult from the 446 hook. Same owner as the practice session.
- G351 H5 directory realpath and `index.html` digest equal to the B139 pin.
- Product source still uses immediate CHOICE click.

## Exact safe validation command

Run later, serialized, after `pnpm ports:check`. `--preflight-only` inspects Docker and ports and rewrites `reading-live-hook.mjs` plus `manifest.json` in this directory. It is the first live command. The no-arg command starts services. This job did not run either.

```
python3.12 -c 'import ast; ast.parse(open("/tmp/grok-mobile-resume-reading-attempt-446/run-reading-owner.py", encoding="utf-8").read())'
node --check /tmp/grok-mobile-resume-reading-attempt-446/reading-practice-h5.cjs
node --check /tmp/grok-mobile-resume-reading-attempt-446/reading-live-hook.mjs
python3.12 /tmp/grok-mobile-resume-reading-attempt-446/run-reading-owner.py --preflight-only
python3.12 /tmp/grok-mobile-resume-reading-attempt-446/run-reading-owner.py
```

Exit 0 with `"status":"PREFLIGHT"` is preflight success. Exit 0 with `"status":"PASS"` and `"reason"` absent on the owner receipt is the live certificate. Exit 2 is a closed reason, including `feedback-not-rendered`, `attempt-body-rejected`, `attempt-key-rejected`, `attempt-not-one`, `observer-stem-literal`, `observer-gate-literal`, `observer-required-literal`, and `observer-g360-unadapted`. Exit 1 is any other failure.

Candidate hashes before REPORT (Python 3.12 hashlib of exact bytes):

| file | SHA-256 |
| --- | --- |
| `run-reading-owner.py` | `675691c978dc8054dcd6da24af521a461c04c8aa1b74f28fe9f11ed55970fd35` |
| `reading-practice-h5.cjs` | `223eb8751d2d4af399fac9534cc3a3dfc21fa498822512d8892f837ec7651702` |
| `reading-live-hook.mjs` | `bf6d7951ec74bbcfc1dbfc4500aa7fe48c968753f3c0061e64501f17d311e0c6` |
| `pins.json` | `365aba8131fc88a711d594dde52e93d38c82f20a521a107c85ea723ac4f52def` |
