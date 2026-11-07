# MB405 same-actor home-return proof (authored, not run)

Status: **PREPARED_NOT_RUN**. This job wrote a bounded runner and observer. It did not start Docker, MySQL, IAM, Gateway, Learner, Content, Learning, Assessment, Chrome, or port 18183. Git, Bash, and `node --check` were not started. No product file, credential, port, or Git state was changed.

The 397 dependency report is still true: IAM `ELIGIBLE` plus `learning.plan.read` does not keep `/pages/home/home`, and a saved goal without a learning pin/plan stays `NOT_READY` / `PLACEMENT_REQUIRED`. This package is the missing executable same-actor lease, not a repeat of that report.

## What was authored

| File | Role |
| --- | --- |
| `pins.json` | Input pins for HEAD, B139 H5, G372 harness, B141 jars, run dir |
| `pin-rebind.cjs` | Copies G372 harness-source and applies exact 405 literals |
| `preflight.cjs` | Classification only; writes `preflight.json` |
| `home-return-observer.cjs` | Fresh login `returnTo=/pages/home/home` and READY home read |
| `home-return-hook.cjs` | `NODE_OPTIONS` preload around `runTargetBrowser` |
| `wrapper.sh` | Serial lease derived from the G372 unset (normal) journey |
| `composition-receipt.json` | COMPOSED / runtime NOT_RUN |

The placement journey stays the reviewed G372/B96 in-process path: mock publication seed, disposable adult via IAM, one G303-shaped target save (`CET_4_6` / `B1` / 30), ten real answers, one `ASSESSED` report, one `POST /api/v1/learning/plans:ensure`. Retest, skip, a second plan write, preference PATCH, and catalog insert stay out.

After that observer returns `OBSERVED`, the hook opens a **new** non-persistent document at `#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome`. The page submits the password. The observer does not assign `location`, storage, or the return path. Static GET/HEAD continue with `x-mb004-static-qa`. No `route.fulfill`.

## Current source oracles (not changed)

`continueAfterLogin` in `apps/mobile/src/auth/navigation.ts` keeps a learning `returnTo` of `/pages/home/home` when the session is learning-ready and the resume step is not `gate`, `consent`, or a readable unsaved goal. With a saved `COLLEGE_CET` target the step is `assessment`, so the stored home path stays open.

`LearnerHttpController.firstDayData` (`services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpController.java` 216–249) promotes home to `READY` only when profile and target are ready, the learning pin matches the saved goal, and the learning plan view is `ACTIVE` with `planningInput`, `plan`, and at least one task. `LearnerHomePlanProjectionTest.activePlanViewPromotesHomeToReadyWithEmbeddedFacts` (lines 77–104) and `confirmedTargetWithoutPlanningFactsStaysNotReady` (test file lines 35–45) are the matching unit oracles. This job did not alter them.

No source bug that blocks this normal entry was found in the current tree. If the lease later lands on onboarding with a saved target, the navigation gate at `navigation.ts` 108–128 and 149–163 is the first seam. If the hash is home and `GET /api/v1/learner/home` is still `NOT_READY` / `PLACEMENT_REQUIRED`, the first seam is `firstDayData` 220–233 (missing pin or plan view), not the observer.

## Exact changes in the staged harness

`pin-rebind.cjs` copies G372 `harness-source` and replaces only these literals, each exactly once:

- `FULL_BROWSER_COMMIT` `3953f8b80d463f3f2a8ebba758b10a4a2610d934` → `61b9ede7c65ef065c76c846c27fb69a52cd042cd`
- unset full-browser Content/Assessment SHA → B141 later pins `852578df…` / `467fb91b…` (the B96 bytes are gone; B141 already completed the normal ten-answer + ensure path on these jars)
- `HISTORICAL_FULL_BROWSER_ROOT` / `FULL_BROWSER_ROOT_ARTIFACT_DIR` / unset `expectedLiteral` → `/private/tmp/grok-mobile-resume-home-405/run`
- `placement-start-read.mjs` historical Content/Assessment exports to the same later pins so `assertJar` does not require the missing B96 bytes

`MB006_PLACEMENT_RETEST_CONTINUATION` stays unset. The wrapper refuses that variable. SQL expectations stay the B96 normal rows (one `COMPLETED` session, ten answers, one `ASSESSED` report, idempotency 11, plan `ACTIVE` version 2, 10 tasks, 3 SRS).

## Pass for the home-return tail

The durable `home-return-receipt.json` must be `OBSERVED` with:

- final hash `/pages/home/home`
- origin `http://127.0.0.1:18183`
- one login POST 200, principal GET 200, `serverAdultStatus` `PASSED`, `learningAccess` `ELIGIBLE`, `learning.plan.read`
- live `GET /api/v1/learner/home` 200, `firstDay.state` `READY`, `targetReady` true, blocker absent, `taskCount >= 1` matching `tasks.length`, `planningInput` and `plan` present, `planVersion` equal to the in-memory `plans:ensure` version
- `routeFulfill` false, `storageInjection` false, `locationAssign` false, extra writes 0

A home that is still `NOT_READY` / `PLACEMENT_REQUIRED` fails even if the hash is home. Identifier, password, bearer, cookie, plan id, and nonce stay out of the receipt.

## Actual checks vs NOT_RUN

| Check | Result |
| --- | --- |
| Current navigation / firstDay / login / home / onboarding-resume source | Read |
| B96 `ROOT-B96-H5-PLACEMENT-LEARNING-20261106.json` and G372 harness-source | Read |
| B139 H5 path and declared index pin `706fffb7…` | Path present; digest **NOT_RUN** in this session |
| G372 later Content/Assessment jar paths | Paths present; digest **NOT_RUN** in this session |
| Learner/Learning jar SHA `62b9dda7…` / `5eff9846…` | Paths present; digest **NOT_RUN** in this session |
| `node --check` of authored files | **NOT_RUN** |
| `pin-rebind.cjs` stage | **NOT_RUN** |
| Preflight | **NOT_RUN** |
| Serial lease / Chrome / IAM 184 / ten answers / ensure / login return | **NOT_RUN** |

## Input pins

- Repo: `/Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy` at `61b9ede7c65ef065c76c846c27fb69a52cd042cd`, tracked tree clean
- Run dir: `/private/tmp/grok-mobile-resume-home-405/run` mode `0700`, not a symlink, `realpath` equal to that path. `/tmp/grok-mobile-resume-home-405/run` fails the canonical check on macOS
- H5: B139 `reading-practice-integrated-g351-root/h5`, index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. G344 `94047adf…` is rejected
- Harness: G372 `harness-source` (the B141 reviewed runtime), not the G372 frozen-only copy
- Jars: Learner `62b9dda7…`, Learning `5eff9846…`, Content B118 `852578df…` at `reading-content-owner-b118-package/content-service-b118.jar`, Assessment G258 `467fb91b…` at `reading-assessment-combined-b122-root/assessment-protected-reading-combined.jar`
- Fixture: `apps/mobile/tests/fixtures/mock-consent-publication.json` `aaf60cd0…`
- Ports: `13306`, `18070`, `18087`, `18088`, `18089`, `18090`, `18091`, `18183`
- Container/label: `cloudstudy-mobile-home-return-405-20261107` / `cloudstudy.qa.mobile-home-return-405-20261107`
- Playwright: G372 `mobile-figma-integration-20261103` package.json, then this worktree

IAM and Gateway jars are built by the existing acceptance harness from the current HEAD. They are not pinned to the 3953f8b8 bytes.

## Remaining prerequisites

1. Root grants the serial lease on the eight fixed ports. Nothing in this package starts a server until that lease runs `wrapper.sh`.
2. Create `/private/tmp/grok-mobile-resume-home-405/run` as a real directory, mode `0700`, empty of `harness`.
3. `chmod 700` this `wrapper.sh`.
4. Preflight must recompute the B139 index digest and the four domain-jar digests. If a mutable `target/*.jar` no longer matches the pin, use the immutable B118/G258 copies already named above, or a still-matching Learner/Learning copy. Do not weaken the SHA check.
5. Repo at `61b9ede7` must be tracked-clean. A detached author-only checkout of that commit is accepted by the full-browser branch check.
6. Cached `mysql:8.0`, Java 25, Node, Chrome channel, OpenSSL, Docker, `rg`, and Playwright from a listed root.

## Exact safe validation command

Classification only (no Docker, no ports, no Chrome):

```sh
node /tmp/grok-mobile-resume-home-405/preflight.cjs
```

Exit 0 prints `"status":"PREFLIGHT"`. Exit 2 is `PREFLIGHT_FAIL` with `processesStarted` false.

One serial lease, after preflight and after Root creates the canonical run directory:

```sh
chmod 700 /tmp/grok-mobile-resume-home-405/wrapper.sh
install -d -m 700 /private/tmp/grok-mobile-resume-home-405/run
bash /tmp/grok-mobile-resume-home-405/wrapper.sh
```

Optional explicit arguments (same literals as `pins.json`):

```sh
bash /tmp/grok-mobile-resume-home-405/wrapper.sh \
  /Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy \
  /tmp/grok-mobile-resume-home-405/staged-harness \
  /private/tmp/grok-mobile-resume-home-405/run \
  <learner jar 62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733> \
  /Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-content-owner-b118-package/content-service-b118.jar \
  /Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-assessment-combined-b122-root/assessment-protected-reading-combined.jar \
  <learning jar 5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f> \
  /Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5 \
  706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32
```

Do not pass `/tmp/grok-mobile-resume-home-405/run`. Do not set `MB006_PLACEMENT_RETEST_CONTINUATION`. Run the lease once. This authoring job did not run either command.

## Scope kept

Writes stayed under `/tmp/grok-mobile-resume-home-405`. The G372, B96, B139, 397, and product trees were read and left in place. Repository handoff/status/review documents were not touched.
