# G412 MB-006 same-key placement retest replay

Status: **PREPARED, NOT RUN**. This is not a PASS. No browser, service, database, container, port, or replay request was started. The frozen G391 snapshot and the G372 trees were not modified.

## Seam

G372/B141 already runs the normal H5 retest: ten real answers, one assessed report, one plan ensure, one confirmed `#assessment-retest`, and one browser `POST .../retest` that must return **201** with a new `CREATED` session. G391 added a capture module and observer fields, then stopped. Those fields were never called, and the pin was still the B100 index.

This job keeps that H5 retest. The only new behavior is:

1. After the existing retest gate accepts the browser POST, and before `route.continue`, store that request.
2. After the browser 201 is a new fresh session and the first question is visible, replay **that same Idempotency-Key once**.
3. Require the replay POST to be **201** with that same new session. `P1PlacementJdbcController.retest` returns `201 CREATED` for the stored replay. The OpenAPI operation lists `201` only. A `200` retest POST fails as `replay-status`.
4. Read the completed report before and after. Both must be **200**, and the raw body must be unchanged.
5. Read the new session. It must be **200**, still `CREATED`, `acceptedSequence` 0, `nextSequence` 1, `stateVersion` 1, with no `completedResult`.
6. Do not post an eleventh answer, a checkpoint, a skip, a second key, or another report.

The browser still continues exactly one retest POST. The explicit replay is the node call, so `retestWrites` stays 1. The G372 database comparison stays the B141 row set. A replay that inserts a session, answer, checkpoint, report, or idempotency row fails that comparison:

```
content_bank	10	266001	266010	266100	266100
assessment_session	2	1	1	1	1
assessment_responses	10	1	10	266001	266010	10	10	0
assessment_checkpoint	10	2	11	2	11	10	0
assessment_result	1	1	10	1	0
assessment_idempotency	12	1	10	1	0
```

The last three assessment lines are the original ten answers, ten checkpoints, and one report, with zero of each on the new session, and one `RETEST` idempotency row. `SKIP` stays 0.

DEC-04 stays `NOT_ASSERTED`. The assessed report in current source has `#assessment-retest` and no `#assessment-skip` control. The probe counts `#assessment-skip` and stops if it is present. It does not click a skip control. `#assessment-skipped` is the already-skipped result view, not a skip CTA.

## Identity

| Pin | Value |
|---|---|
| Run directory | `/private/tmp/grok-mobile-resume-retest-replay-412/run` |
| Container | `cloudstudy-mobile-placement-retest-412-20261107` |
| Lease | `cloudstudy.qa.mobile-placement-retest-412-20261107` |
| Repo | `61b9ede7c65ef065c76c846c27fb69a52cd042cd` |
| H5 | `reading-practice-integrated-g351-root/h5` |
| H5 index SHA-256 | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |

The B100 index `6416f7f58a19b9cf7821288e5ada237f236009ec04f9b19b8e0bdc02d9433519` is not accepted. App and domain jars stay the G372 pins because this repo move is the static CI pin, not an assessment change.

## Reused files, copied read-only at runtime

From `/tmp/grok-mobile-placement-retest-canonical-macos-run-372`:

- `wrapper.sh`
- `acceptance-learner-target.mjs`
- `learner-target-probe.mjs`
- `browser-target-probe.cjs`
- `placement-start-read.mjs`

From that run's `harness/`:

- `learning-plan-ensure.mjs`
- `process_guard.py`
- `seed/Seed.java`
- `sql/seed-full.sql`
- `sql/seed-partial.sql`
- `sql/cleanup-fixtures.sql`

Jar pins, unchanged:

- Learner `62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733`. Root supplies the jar. The G372 command did not record its path.
- Content `852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2` at `/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/services/content-service/target/content-service-0.1.0-SNAPSHOT.jar`.
- Assessment `467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912` at `/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-assessment-combined-b122-root/assessment-protected-reading-combined.jar`.
- Learning `5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f`. Root supplies the jar. The G372 command did not record its path.

`placement-start-read.mjs`, the seed, the SQL, and the plan helper are not patched.

## Patched at stage time

`apply-replay-seam.mjs` edits only the staged copies:

- `wrapper.sh`: 412 run root, container, lease, B139 H5, repo `61b9ede7c65ef065c76c846c27fb69a52cd042cd`, and the replay opt-in passed into Node.
- `acceptance-learner-target.mjs` and `learner-target-probe.mjs`: the same run root and repo pin. Callback keys stay `full`, `fullArtifact`, `fullIndexSha`, `retestContinuation`.
- `browser-target-probe.cjs`: capture, one replay call, skip-control absence, and the receipt fields.
- `full-browser-owner.mjs` is the replacement observer, not a patch of the G372 observer.

G391's frozen pair stays at `worker-snapshots/391/` and `/tmp/grok-mobile-placement-replay-browser-lease-391/`. It is not on the runtime path.

## Root command

Create the run directory first, mode `0700`, with no `harness` child. Passing `/tmp/grok-mobile-resume-retest-replay-412/run` fails the canonical-path check. Remove `staged/` before a second attempt. This preparation did not create `run/` or `staged/`.

```sh
mkdir -m 0700 /private/tmp/grok-mobile-resume-retest-replay-412/run
MB006_PLACEMENT_RETEST_CONTINUATION=MB006_PLACEMENT_RETEST_CONTINUATION \
MB006_PLACEMENT_RETEST_REPLAY=MB006_PLACEMENT_RETEST_REPLAY \
  bash /private/tmp/grok-mobile-resume-retest-replay-412/wrapper.sh \
  /Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy \
  <learner jar 62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733> \
  /Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/services/content-service/target/content-service-0.1.0-SNAPSHOT.jar \
  /Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-assessment-combined-b122-root/assessment-protected-reading-combined.jar \
  <learning jar 5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f>
```

The repo must be clean at `61b9ede7c65ef065c76c846c27fb69a52cd042cd`. Direct execution of `placement-retest-same-key-replay.cjs` sends nothing and exits 2. The observer's `PASS` value is computed only from a real receipt. No receipt was produced here.
