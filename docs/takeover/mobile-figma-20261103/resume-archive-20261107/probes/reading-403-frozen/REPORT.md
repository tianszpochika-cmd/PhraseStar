# G403 one-click published-reading feedback — PREPARED, NOT RUN

This session authored the G399 continuation lease. It did not start Docker, a JVM, Node, Chrome, MySQL, or the static server. It did not bind a port, change Git, or edit product source. Historical G360/G387 receipts are not this runtime.

Directory: `/tmp/grok-mobile-resume-reading-403`

On macOS this is the same directory as `/private/tmp/grok-mobile-resume-reading-403`.

## What G399 left

G399 exited 143 during user pause. The snapshot at `worker-snapshots/399` is the G360 package copied unchanged:

- `reading-live-hook.mjs` SHA-256 `b2260bb649fd8d6ab0c3cdf7e82ccdec10edf27453670c205612bf5b9ee8b5e8`
- `reading-practice-h5.cjs` SHA-256 `fa504d284cbcd8fe9a56c9f32cf0c1d5c871b53dc288a2f60a858c557b3ac0a1`
- `run-reading-owner.py` SHA-256 `70d2cb1c92afc5b64fd913949f6fc6eea6ad3ab4dbe5c3387b54190558f7e55c`

Those three files still name `/tmp/grok-mobile-reading-integrated-h5-runtime-pin-360`. They keep `attemptWrites` 0 and do not click a CHOICE option. This session reused them as frozen inputs and wrote a new 403 lease instead of executing them.

## Exact changes in this directory

- `reading-practice-h5.cjs` loads frozen G280 `679db31207ef097a117170a88b1ba2d305f0755b7f2ddc38f5c070be91573137`, keeps the G338/G360 uni-button CTA and keyboard practice entry, then after same-session question readback clicks the first visible `.b10-exercise-card .b10-option`. That click is the submit. The wrapper refuses `.b10-submit` and `.v2-b2p-submit` as click targets. One POST `/attempts` is continued, `[data-save-receipt]` / `[data-feedback-text]` must render `已保存` plus visible feedback text, then the same Idempotency-Key and body are replayed. Leak lists stay. Reason on success is `published-practice-scored`.
- `run-reading-owner.py` is the bounded owned lease. It hash-checks G314/G280/G360/G387/G399 pins, rebinds identity 403, pins B139/G351 H5 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`, requires G387 session facts `ASSESSED` / `attempts` 1 / `outbox` 3 / `state_version` 2, and keeps Learning 18090 untouched. Failure receipts are redacted. Owned cleanup stays the G314 `releasedProof` block.
- `reading-live-hook.mjs` is the G314 hook rebound to `MB403_READING_LIVE_HOOK` / `MB403_RUN_ID` / `mb403-reading-live-hook/1`. The runner rewrites this file from frozen G314 before exec. No `/api/v1/reading` or `/api/v1/assessment` and no `route.fulfill`.
- `pins.json` lists the frozen inputs above.

G387 `reading-assessment-score.mjs` SHA-256 `d5435882744debab29b679c65da88935978dd0c25b110cc613a507ea12e16fa5` is a hash and predicate pin (`selectedOptionKeys`, `已保存`, same-key replay, `snap_reading_`). This lease does not execute that CLI, so it does not open a second session.

## Lease 403

Canonical directory: `/tmp/grok-mobile-resume-reading-403` (macOS `/private/tmp` is the same directory). Docker label `cloudstudy.qa.mobile-resume-reading-403-20261106` after the G314 name replace (the frozen runner keeps its 20261106 suffix). Container `cloudstudy-mobile-resume-reading-403-20261106`. Scratch prefix `cloudstudy-mobile-resume-reading-403.`. Hook marker `MB403_READING_LIVE_HOOK`. Run id env `MB403_RUN_ID`. Receipt kind `MB403`. Credential `mb403-{runId}@example.invalid`, password prefix `Mb403!`.

Five service JVMs stay IAM, Gateway, Learner, Content, and Assessment. Registered ports from `config/local-ports.json` and the runner lease: MySQL 13306, Gateway 18070, IAM TLS 18087, Learner 18088, Content 18089, Assessment 18091, H5 18183. Learning 18090 stays in `UNTOUCHED`. No broker. No Learning consume claim.

Publication scope stays G360/G387: article 88061, item 88062, `reading.bind.b9`, owner snapshot `snap_reading_{version}`, numeric public snapshot id. G387 live version was 266101. This lease reads the current fixture version and requires one owner.

## Source used for the click

Current `apps/mobile/src/components/b10/B10ExerciseCard.vue` `choose()` emits `{ selectedOptionKeys: [key] }` on the option click. `b2-practice.vue` `answer()` calls `store.submitAnswer` immediately. The text-answer `提交答案` control is in the `FILL_BLANK` / `SPELL_INPUT` / `ERROR_CORRECTION` / `TRANSLATION_INPUT` branch. A `READING` item mapped to `CHOICE` does not render it. `v2-b2p-submit` is the finished-panel report button. The G351 bundle `B10ExerciseCard.CgmwYBi0.js` and `pages-b2-practice-b2-practice.CnL1UD5o.js` are the files the pinned H5 serves.

Feedback nodes on the practice page are `[data-save-receipt]` and `[data-feedback-text]` inside `v-else-if="exercise"`. For a one-item session, `submitAnswer` writes `answerResults` before `lastResult` is assigned, so that branch can unmount. The observer still requires those nodes. A live miss is `feedback-not-rendered`, not a rewritten oracle.

## Actual checks vs NOT_RUN

Checked by reading, with no process started:

- G399 snapshot hashes match G360 frozen hashes.
- G387 runtime receipt already has `attempts` 1, `outbox` 3, `h5Proof` false, `learningStarted` false, `broker` false.
- B139 evidence `h5IndexSha256` equals G351 `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`.
- Frozen G314/G280/G360/G387/G351/G399 paths exist as regular files.
- Playwright worktree `mobile-figma-integration-20261103` and content owner worktree `mobile-content-reading-article-owner-20261106` exist for the G314 runtime.
- CHOICE click is the submit in current source and in the G351 card bundle.
- This session did not parse-check, `node --check`, preflight, or run the owner runtime.

NOT_RUN:

- `python3 -c` AST parse of the runner
- `node --check` of the observer and hook
- `--preflight-only`
- live owner runtime
- browser option click
- Gateway attempt POST and replay
- MySQL session readback
- port lease and cleanup

## Remaining prerequisites

- One serialized runtime on the fixed ports above. Learning 18090 and Kafka 19092 stay down.
- Docker context `desktop-linux`, G314 MySQL image, IAM/Gateway/Learner/Content/Assessment jars and the G251 fixture.
- Fresh synthetic adult from the 403 hook. Same owner as the practice session.
- G351 H5 directory realpath and `index.html` digest equal to the B139 pin.
- Product source still uses immediate CHOICE click. Do not add a second submit control.
- If the one-item exercise panel unmounts before `[data-save-receipt]` paints, the next seam is to keep those nodes visible after save. That is a product source change and is outside this authoring.

## Exact safe validation command

Run later, serialized, after `pnpm ports:check`. `--preflight-only` inspects Docker and ports and rewrites `reading-live-hook.mjs` plus `manifest.json` in this directory. It is the first live command. The no-arg command starts services.

```
python3 -c 'import ast; ast.parse(open("/tmp/grok-mobile-resume-reading-403/run-reading-owner.py", encoding="utf-8").read())'
node --check /tmp/grok-mobile-resume-reading-403/reading-practice-h5.cjs
node --check /tmp/grok-mobile-resume-reading-403/reading-live-hook.mjs
python3 /tmp/grok-mobile-resume-reading-403/run-reading-owner.py --preflight-only
python3 /tmp/grok-mobile-resume-reading-403/run-reading-owner.py
```

Exit 0 with `"status":"PREFLIGHT"` is preflight success. Exit 0 with `"status":"PASS"` and `"reason"` absent on the owner receipt is the live certificate. Exit 2 is a closed reason, including `feedback-not-rendered`. Exit 1 is any other failure. This session ran none of those commands.

This is not route or DoD signoff. B139 create/read and B144 direct score/replay stay the prior proofs. Learning consume stays unclaimed.
