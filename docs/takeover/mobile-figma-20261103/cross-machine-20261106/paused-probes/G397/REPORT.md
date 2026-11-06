# MB001 home return stops before eligible readiness

Status: **STOPPED**. Normal home readiness cannot be supported from the approved B140/G361 owner or from the released B141 and B96 placement rows. This job writes this report only. No H5 observer is included.

No product file, credential, plan, config, port, or Git state was changed. Bash, Git, Node, Java, Chrome, MySQL, and Docker were not started. The G344, G361, B139, B96, and B141 trees were read and left in place.

## What G344 already showed

`/tmp/grok-mobile-auth-recovery-owner-runtime-344/recovery-receipt.json` is a real same-actor receipt:

- wrong password HTTP 401 `iam.credentials.invalid`, stayed on `/pages/login/login`, no cookie
- correct login HTTP 200, principal HTTP 200, `serverAdultStatus` `PASSED`, `learningAccess` `ELIGIBLE`
- final hash `/pages/onboarding/onboarding`
- receipt status `FAILED`, reason `safe-landing-missing`
- `indexSha256` `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` (the older B116 static)
- `routeFulfill` false, `storageInjection` false

That lease was IAM-only. It had no saved learner target. Current `readTargetFact` treats `GET /learner/targets` 404 as readable and unsaved. `selectOnboardingResumeStep` then returns `goal`, and `redirectIfResumeBlocksLearning` sends a learning `returnTo` to onboarding. IAM `ELIGIBLE` plus `learning.plan.read` is `isLearningReady`. That flag does not by itself keep `/pages/home/home`.

## Current return gate

`apps/mobile/src/auth/navigation.ts` `continueAfterLogin` keeps `/pages/home/home` only when the session is learning-ready and the resume step is not `gate`, `consent`, or a readable unsaved goal. `/pages/home/home` is a learning path. `safeMobileRouteReturnTo` accepts `/pages/home/home` after at most two leading percent-decodes.

`apps/mobile/src/domain/onboarding-resume.ts` chooses the step from the adult gate, consent, and `GET /learner/targets` only. Its comment states that first-day blockers are not inputs. A target is saved only when the goal maps and the quota is 5, 15, 30, or 45. The approved G303 body does that: `CET_4_6` / `B1` / 30 minutes is stored as `COLLEGE_CET`, `B1`, `stateVersion` 1 (`reading-runtime-grant-quoting-303-frozen/reading-live-hook.mjs`). With that target, the step is `assessment`, and the navigation gate opens the stored home path.

Opening the path is not eligible readiness. `apps/mobile/src/pages/home/home.vue` stays on the route and shows the assessment guide while placement is unfinished. The H5 assets under the B139 tree do not contain the literal `PLACEMENT_REQUIRED`. The page does not invent a ready plan.

## Why the approved owner is not ready

G361 `actual-receipt.json` and `ROOT-B140-LEARN-CATALOG-OWNER-WIRE-20261106.json` record the same owner wire:

- preference `en-US`, `preferenceVersion` 1
- home `firstDayState` `NOT_READY`, blocker `PLACEMENT_REQUIRED`, `taskCount` 0, `contentStatus` `EMPTY`
- catalog `itemCount` 0, `learnerVisiblePublished` 0, `sealedPublished` 1
- `runnerBusinessInserts` 0, `planReads` 0, `unrelatedWrites` 0
- `h5Started` false, `databaseReleased` true
- learning port 18090 left untouched

`LearnerHttpController.toFirstDay` is the matching rule. A saved goal with no planning facts stays `NOT_READY` / `PLACEMENT_REQUIRED`. `LearnerFirstDayHttpMappingTest.confirmedTargetWithoutPlanningFactsStaysNotReady` asserts that pair. `firstDayData` promotes the page to `READY` only when all of these are true:

1. profile and target are ready
2. a target pin exists and its `targetId` matches the saved goal
3. the learning plan view is `ACTIVE`, with `planningInput`, a `plan` object, and at least one task

Anything else keeps the baseline. A missing pin returns before the plan view is applied. `TargetPinController` says only learning-service writes that pin, after it has verified the placement report. `V2PlansController.ensure` verifies an `ASSESSED` report, pins, then rejects a stale target version. A direct pin or a hand-built plan would be an extra business write and would skip that check.

The G303 target PUT is the authorized synthetic setup. It does not create the pin or the plan. G361 recorded `planReads` 0 after that PUT.

## Released placement facts

B96 `ROOT-B96-H5-PLACEMENT-LEARNING-20261106.json` is one completed placement on a different disposable actor: 10 answers, 10 checkpoints, 1 `ASSESSED` report, one plan ensure HTTP 200, plan `ACTIVE` version 2, 30 minutes, 10 tasks, today 3 due rows, home and catalog HTTP 200. Its H5 index is `8493c786ac57fe421742f5640eb52a6f6f4c82d9fcfafe1cc3a853290a30fa69`. Temporary MySQL was released.

B141 `ROOT-B141-PLACEMENT-RETEST-H5-20261106.json` is another actor: ten responses, one plan ensure HTTP 200, then one confirmed retest HTTP 201 whose new session has 0 answers and 0 reports. `dec04` is `NOT_ASSERTED`. Its H5 index is `6416f7f58a19b9cf7821288e5ada237f236009ec04f9b19b8e0bdc02d9433519`. Cleanup is true. It does not record `firstDay.state` `READY` or a home `returnTo`.

Those rows are not the B140 owner, and both databases are gone. Replaying them onto a new actor is a complete placement again. Copying them across owners is not an approved read.

## B139 static that a later proof must use

The current static trust is the integrated tree:

`/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5`

Index pin used by the B139 leases: `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. Header `x-mb004-static-qa`. This session did not recompute that digest. The G344 index `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` is the wrong static for this return.

## Smallest actual proof

One new disposable adult, because the G361 database is released. Repeat only the already authorized G303 setup, then the placement that produces the pin and the plan. Do not fulfill responses and do not grant a permission the login does not already receive.

1. Serve the B139 tree above after the index bytes match `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. Continue static GET and HEAD with `x-mb004-static-qa`. No `route.fulfill`.
2. Register one synthetic adult, pass the adult gate, record the three required consents, and confirm principal `learningAccess` `ELIGIBLE` with `learning.plan.read`.
3. One target PUT, the G303 body: `expectedStateVersion` 0, `goalCode` `CET_4_6`, `targetLevel` `B1`, `dailyQuotaMinutes` 30, `status` `ACTIVE`. Accept it only when the readback is `COLLEGE_CET`, `B1`, `stateVersion` 1. No preference PATCH and no catalog insert.
4. Complete placement again on that same actor: ten real responses, one owner-verified `ASSESSED` report, one `POST /api/v1/learning/plans:ensure` for that report. Learning-service must pin the target and store an `ACTIVE` plan with `planningInput`, `plan`, and at least one task. Skip, retest, and a second plan write stay out of this proof.
5. One correct login, as a fresh document load, at `#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome`. The page submits the password. The observer must not assign `location`, storage, or the return path.
6. Pass is final hash exactly `/pages/home/home`, origin `http://127.0.0.1:18183`, login HTTP 200, principal HTTP 200, `learningAccess` `ELIGIBLE`, and the live `GET /api/v1/learner/home` body `state` `READY`, `targetReady` true, blocker absent, and task count at least 1. A home that is still `NOT_READY` / `PLACEMENT_REQUIRED` fails this proof even if the hash is home.

Until step 4 has run, step 6 cannot pass. That is why this job stops.
