# G416 repair of G403 observer-seam preflight — PREPARED, NOT RUN

Root ran Python 3.12 `--preflight-only` on G403. It failed `observer-seam` before services. This session repaired the deriver binding in a new identity-416 lease. It did not start Docker, a JVM, Node runtime, Chrome, MySQL, or the static server. It did not bind a port, change Git, or edit product source. Original G403 and frozen inputs were not written.

Directory: `/tmp/grok-mobile-resume-reading-repair-416`

On macOS this is the same directory as `/private/tmp/grok-mobile-resume-reading-repair-416`.

## Exact preflight failure

Root diagnostic `PREFLIGHT-DIAGNOSTIC.json` listed the expected stem literals:

- `stem_needle` `\'"gradableQuestions"\', \'readingRuleSeal\', \'Owner stem\',` count 1
- `stem_kept` `\'"gradableQuestions"\', \'readingRuleSeal\',` count 2

Offline count of the preseeded wrapper already matched those counts (`stem_needle` 1, `stem_kept` 2, owner-pair present). `require_observer_text` was not the failing gate.

The actual `observer-seam` was the G314 deriver `replace_exact` for the observer status gate. G403 searched for a line that started with `or parsed.get("status") != "OBSERVED"`. Frozen G314 line 1886 is `code != 0 or parsed.get("status") != "OBSERVED" or parsed.get("reason") != "published-practice"`. Count of that old needle in G314 was 0, so `replace_exact(..., "observer-seam")` exited 2 before services.

## Exact changes in this directory

- `run-reading-owner.py` binds that gate to the real G314 bytes (`code != 0 or parsed.get("status")...`), injects `published-practice-scored` plus `attemptPosts`/`attemptReplays` 1, rebinds identity 416, and rejects leftover 314/360/387/399/403 markers in the derived runner. Wrapper stem counts stay 1 and 2. Missing required observer strings now fail `observer-required-literal`. Stem count/owner-pair mismatch fails `observer-stem-literal`. Gate byte mismatch fails `observer-gate-literal`. An unadapted G360 wrapper hash fails `observer-g360-unadapted`. Leak/shell guards stay `observer-seam`.
- `reading-practice-h5.cjs` keeps the G280 load, G338/G360 uni-button CTA, one visible `.b10-exercise-card .b10-option` click as the submit, one continued POST `/attempts`, `[data-save-receipt]` / `[data-feedback-text]`, same-key replay, SESSION_LEAKS/OUTPUT_LEAKS/FORBIDDEN, and `feedback-not-rendered`. Only the lease header comment changed G403 → G416.
- `reading-live-hook.mjs` is rebound to `MB416_READING_LIVE_HOOK` / `MB416_RUN_ID` / `mb416-reading-live-hook/1`. The runner still rewrites this file from frozen G314 before exec.
- `pins.json` names job `resume-20261107-mobile-reading-416`, kind `MB416`, source `/tmp/grok-mobile-resume-reading-repair-416`. Frozen pin paths and SHAs are unchanged.

B139/G351 H5 index pin stays `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. G387 session facts stay `ASSESSED` / `attempts` 1 / `outbox` 3 / `state_version` 2. Learning 18090 stays `UNTOUCHED`.

A live miss of saved/feedback DOM stays `feedback-not-rendered`. That is a reported product bug until an independent product fix keeps those nodes mounted after a one-item CHOICE save. This lease does not loosen that oracle.

## Lease 416

Canonical directory: `/tmp/grok-mobile-resume-reading-repair-416` (macOS `/private/tmp` is the same directory). Docker label `cloudstudy.qa.mobile-resume-reading-repair-416-20261106` after the G314 name replace (the frozen runner keeps its 20261106 suffix). Container `cloudstudy-mobile-resume-reading-repair-416-20261106`. Scratch prefix `cloudstudy-mobile-resume-reading-repair-416.`. Hook marker `MB416_READING_LIVE_HOOK`. Run id env `MB416_RUN_ID`. Receipt kind `MB416`. Credential `mb416-{runId}@example.invalid`, password prefix `Mb416!`.

Five service JVMs stay IAM, Gateway, Learner, Content, and Assessment. Registered ports: MySQL 13306, Gateway 18070, IAM TLS 18087, Learner 18088, Content 18089, Assessment 18091, H5 18183. Learning 18090 stays in `UNTOUCHED`. No broker. No Learning consume claim.

Publication scope stays G360/G387: article 88061, item 88062, `reading.bind.b9`, owner snapshot `snap_reading_{version}`, numeric public snapshot id.

## Original 403 status

Left unread-write:

- `/tmp/grok-mobile-resume-reading-403/run-reading-owner.py` SHA-256 `9500b7e232432b10cbb59e2cda42d0c0e9fd149cd7932fb3b943fd5bc9c0ee7e`
- `/tmp/grok-mobile-resume-reading-403/reading-practice-h5.cjs` SHA-256 `711a0560edb2aa6661e3368e6a2bcbce7f2551e326ea57015a0fe04510a5bd67`
- `/tmp/grok-mobile-resume-reading-403/reading-live-hook.mjs` SHA-256 `04c7dc81f34633c4839f7fb3ece0b503512f9406c969ba95980ff305b12c8206`

Those match `reading-403-frozen`. The broken gate needle remains in original 403.

## Actual checks vs NOT_RUN

Checked this session, no service started:

- Frozen G314 observer-gate line 1886 starts with `code != 0 or parsed.get("status")`. G403 old needle count was 0. G416 old needle count is 1.
- Wrapper stem counts: `stem_needle` 1, `stem_kept` 2, owner-pair present.
- `python3 -c ast.parse` of `run-reading-owner.py` succeeded.
- `node --check` of `reading-practice-h5.cjs` and `reading-live-hook.mjs` succeeded.
- Offline import of the 416 runner: `require_observer_text` passed; `transform(G314)` passed; `compile(derived)` passed.
- Derived G314 contains MB416, choice click, saved/feedback, `published-practice-scored`, attempts 1, outbox 3, `ASSESSED`, B139 index, `UNTOUCHED = (18090,)`. It does not contain MB314/MB403, `"attempts": 0`, the frozen G280 observer path, `shell=True`, or `os.system(`.
- Original 403 and `reading-403-frozen` hashes are unchanged.

NOT_RUN:

- `--preflight-only` of the derived G314 owner (that inspects Docker and ports and would rewrite hook/manifest)
- live owner runtime
- browser option click
- Gateway attempt POST and replay
- MySQL session readback
- port lease and cleanup

## Remaining prerequisites

- One serialized runtime on the fixed ports above. Learning 18090 and Kafka 19092 stay down.
- Docker context `desktop-linux`, G314 MySQL image, IAM/Gateway/Learner/Content/Assessment jars and the G251 fixture.
- Fresh synthetic adult from the 416 hook. Same owner as the practice session.
- G351 H5 directory realpath and `index.html` digest equal to the B139 pin.
- Product source still uses immediate CHOICE click. Do not add a second submit control.
- If the one-item exercise panel unmounts before `[data-save-receipt]` paints, the live reason is `feedback-not-rendered`. That remains a product bug until independently fixed.

## Exact safe validation command

Run later, serialized, after `pnpm ports:check`. `--preflight-only` inspects Docker and ports and rewrites `reading-live-hook.mjs` plus `manifest.json` in this directory. It is the first live command. The no-arg command starts services.

```
python3 -c 'import ast; ast.parse(open("/tmp/grok-mobile-resume-reading-repair-416/run-reading-owner.py", encoding="utf-8").read())'
node --check /tmp/grok-mobile-resume-reading-repair-416/reading-practice-h5.cjs
node --check /tmp/grok-mobile-resume-reading-repair-416/reading-live-hook.mjs
python3 /tmp/grok-mobile-resume-reading-repair-416/run-reading-owner.py --preflight-only
python3 /tmp/grok-mobile-resume-reading-repair-416/run-reading-owner.py
```

This session ran the first three. It did not run `--preflight-only` or the owner runtime.

Exit 0 with `"status":"PREFLIGHT"` is preflight success. Exit 0 with `"status":"PASS"` and `"reason"` absent on the owner receipt is the live certificate. Exit 2 is a closed reason, including `feedback-not-rendered`, `observer-stem-literal`, `observer-gate-literal`, `observer-required-literal`, and `observer-g360-unadapted`. Exit 1 is any other failure.

This is not route or DoD signoff. B139 create/read and B144 direct score/replay stay the prior proofs. Learning consume stays unclaimed.
