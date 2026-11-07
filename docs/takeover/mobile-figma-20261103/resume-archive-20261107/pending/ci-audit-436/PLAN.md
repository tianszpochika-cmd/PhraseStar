# G436 CI contract audit closeout

Commit `f69fd71f2adc683441face4d4d7d79dd0c2c3a89` (`f69fd71f`). Real CI: 9 jobs, 7 pass, 2 fail. This audit’s primary extract is contracts/data job `128442811764`, run `42385657308`: evidence gate PASS; `pnpm test:p1r` 1481 tests, 1455 pass, 26 fail. Later steps in that job were NOT_RUN. No source or Git writes in this audit. `diagnose.txt` and `diagnose.mjs` stay as the evidence log.

Checkout `61b9ede` is historical. Application and contract files that these 26 tests read are the same at `f69`; the `61..f69` delta is CI, docs, and evidence-gate only. The 26 failures pre-exist both commits. Evidence SHA compares recorded source blobs. Do not rewrite historical manifests or digests.

Current phase is iteration 2 / R1 (AGENTS.md §0). These 26 are existing P1R CI guards reused on `dev`. They are not a new R1 queue, and a green guard does not move R1 completion. The only R1 id already written on the failing Gateway checker is the R1-019 comment (placement start is no longer executed). Do not open R1 cards from this audit.

Public `POST /api/v1/auth/register` stays. AGENTS.md authorizes it for adults 18+. Test 428 names that route only because emptying `routeExecutions` fails the whole document.

## 26 observations, 10 causes

| ID | Tests | Class | Meaning |
| --- | --- | --- | --- |
| RC-A | 67, 70, 73 | true gap, plus one settled conflicting gate | External-write idempotency. Signed-access stays a singleton. |
| RC-B | 67, 70 | true gap | `listUnfinishedSagas`, `listAssessmentMistakes` lack cursor pagination and the implementations do not page. |
| RC-C | 182 | true gap (two `const`) and reviewed policy update (lexeme/item) | B9/B10 lifecycle vs frozen M1-008. |
| RC-D | 217, 221, 225, 228, 231, 234, 235, 244, 248, 249, 421 | baseline / governance | M2-001 OpenAPI projection cannot be built, and HEAD is wider than that projection. |
| RC-E | 209, 217, 221, 225, 228, 231, 234, 235, 238, 244, 731 | baseline / governance | Current event catalog is not the frozen M1-018 projection. |
| RC-F | 252 | reviewed inventory update, plus a too-narrow scanner exemption | Five migration `fileCount`s; `ASSESSMENT_SERVICE.equals` is not SQL. |
| RC-G | 419, 428, 442 | stale test expectations, plus a reviewed count and reason lock | Gateway public 365→404, internal 66→70; `iam-account-deletions` reason is stale. Route/plan/digest already match. |
| RC-H | 457 | true gap | Five frontend calls hit withheld Gateway rules. |
| RC-I | 632, 633 | reviewed policy inventory | Two canonical learning routes missing from the frozen M1-013 list. |
| RC-J | 738 | stale test | Adult-gate range check is already in the right place. The assertion finds the null-birth-year string first. |

Tests 71 and 72 passed. Test 70 fails because the canonical fixture is already dirty, not because `oneOf` envelopes are invalid. Kind `all` tests stay red until both RC-D and RC-E land. Tests 235 and 244 fail on that trailing `kind: 'all'` assert (`false !== true` at the git-baseline line). Test 209 is `kind: 'events'` only (RC-E). Tests 248, 249, and 421 are the OpenAPI projection (RC-D).

Raw `validateApiContractData` also reports envelope gaps the CI fixture rewrites away (learner substitute 200; admin recovery 201/200; saga read and compensate 200; risk cases and `rules:evaluate` 200/201). Those are not part of the 26. Do not loosen the envelope rule. A later change may stop the fixture from hiding them. This closeout does not expand that list.

## Settled, do not waive

- Exactly one signed-access exception: `POST /api/v1/content/media/{mediaAssetId}/signed-access`, operationId `signContentMediaAccess`. Count stays `=== 1`. Do not change it to `>= 1`.
- External `list*` and any cursor/`x-pagination` operation still need `x-pagination.mode=cursor` and exactly one `#/components/parameters/Cursor` and `PageSize`, with `ApiCursorPageEnvelope`.
- A required idempotency rule still needs a resolved header named `Idempotency-Key`, `in=header`, `required=true`.
- `POST /api/v1/media/assets/{assetId}/upload-url` (`mintMediaUploadUrl`) stays without `x-idempotency`. `scripts/contracts/validate-contracts.mjs` allows that omission only for this route, only with `x-fail-closed` mode `NO_SUCCESS_PATH`, `sideEffects false`, status 503, reason `MEDIA_UPLOAD_PUT_GRANT_UNAVAILABLE`, runtimeStatus `FAIL_CLOSED_UPLOAD_NOT_CONFIGURED`, and no 2xx. Adding `x-idempotency` fails that gate. The p1r checker must recognize that same predicate and skip the write-idempotency requirement. It must not count this route as signed-access.
- OAS 3.0.3 `const` ban stays. Use a singleton `enum`.
- Cross-service schema scan stays. Bare `assessment_service.table` and `ASSESSMENT_SERVICE.attempt` must still fail.
- Withheld-route check stays. Tests 458–461 stay.
- Adult-gate null check, `age < 0 || age > 150`, and `TrustedAgeEvidence` range stay. Registration stays open for 18+.
- Account-deletion `POST` create stays service-side 503 until reauthentication and cross-owner receipt exist.
- Do not retarget source pins or overwrite historical expected digests:
  - M2-001 OpenAPI source semantic `a154f2004f06e5da096abea630855152fac9e87224ad48565a38e6010ab9416b` (matches)
  - M2-001 source commit `66246d5b4a68a988a9af4ece68a446640b123812`; previous `97497afe1f31703601d1491c8d47d00121c90089`
  - M1-018 event source `4a1357e308271533e66e25bceba4ccb164ee5c2d58652b642b252895028a8ac2` (matches)
  - M1-018 expected semantic `5dd1edfae663dd4fcc2975e6ec44e4272efae19ac049c4098bb1be8033ce1548` (current catalog does not match; leave the pin)
  - M1-018 descriptor `c3fa4291254d7c83ec0b690c648fb86437fa72dac84f65744284caac7dd51767` (actual differs; leave the pin)
  - Execution-target plan `f6e9cb48732fd64abd8a89f5f7d9c1dd6892981c13722a0def638343ea5fb80d` (live summary already matches)
  - CI baseline `463c4b238caceb1592bff6c61327c00ab9bac922`; governance `868c2177f62b6d2cf613bed702686dddcfe6943f`
- Gateway route rules 75, execution plans 75, available execution ops 226, and that digest are already frozen-correct. Do not reopen them. Do not add Gateway nodes beyond the lists in RC-G.

`runGitBaselineCompatibility` on the CI baseline is `compatible: false` with exactly four breaks: `m2-001.gateway-root`, `m2-001.projection`, `m1-018.change-descriptors`, `m1-018.projection`. Promotion id `P1R-M2-001`, scope `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`, runtime `NOT_RUNTIME_VERIFIED`.

## RC-A — external-write idempotency

Class: true contract gap, plus alignment with the settled upload-url fail-closed gate. Not a waiver of signed-access.

CI test 67 lists these idempotency errors (pagination lines belong to RC-B):

- `issueLearningReportShare` is not the sole signed-access exception
- that operation’s optional key lacks `x-p1r-idempotency-exception`
- `revokeLearningReportShare` must reference a required `Idempotency-Key` header
- `mintMediaUploadUrl` needs `x-idempotency`
- exactly one signed-access exception is required; found 2

Source:

- `packages/contracts/openapi/v1/openapi.json` `issueLearningReportShare` (`required: false`, inline optional header, no exception extension). Description and clients already mint a new ref when the key is absent.
- same file `revokeLearningReportShare`: `x-idempotency.required: true`, parameters are only the path `ref`.
- same file `mintMediaUploadUrl`: exact `x-fail-closed`, no `x-idempotency`, no 2xx.
- `scripts/audit/p1r-api-contract-check.mjs` counts every external `required: false` as the signed-access exception and requires `x-idempotency` on every external write.
- `scripts/contracts/validate-contracts.mjs` forbids `x-idempotency` on that one upload route.
- Clients that omit the share key: `apps/learner-web/src/api/b10.ts` `issueReportShare`; `apps/mobile/src/api/b10.ts` `issueReportShare` (sends a key only when the caller passes one). Both `revokeReportShare` functions also omit a key.
- Owner: learning-service for share/revoke behavior and contract; media-service owns the upload route but the checker change is contracts governance. Do not change media runtime to invent a success path.

Forward fix:

1. Keep `SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION` exactly `signContentMediaAccess`. Its counter stays `=== 1`.
2. Reviewed second class, set equality `{issueLearningReportShare}` only. It is a durable share mint, not signed-access. Require `x-p1r-idempotency-exception` with rule, reason, owner, and safeBehavior. A third `required: false` write must still fail. Update test 73 to the new exact message. Do not fold report-share into signed-access.
3. In the p1r checker, skip the `x-idempotency` requirement only when the operation matches the existing upload-url predicate above. Do not add `x-idempotency` to the operation. `validate-fail-closed-write` must still reject that addition.
4. Revoke stays `required: true`. Add the canonical required `Idempotency-Key` parameter and make learning-service, learner-web, and mobile send it. Do not drop `required: true` to match today’s keyless callers.

Checks: `tests/p1r/p1r-api-contract.test.mjs` tests 67, 70, 71, 72, 73; `scripts/contracts/validate-fail-closed-write.test.mjs`. Negative: a second signed-access exception still fails; an extra optional write still fails; upload-url with `x-idempotency` still fails; revoke without the header still fails.

## RC-B — list pagination

Class: true gap. Contract-only annotations that leave a raw array or a full dump would lie.

Source:

- `GET /api/v1/admin/recovery/sagas/unfinished` `listUnfinishedSagas`. Response schema is `string[]`. `services/workflow-service/.../SagaController.java` `unfinished()` calls `service.unfinished(200)` and returns `List<String>`. `apps/admin-web/src/api/recovery.ts` expects `string[]`.
- `GET /api/v1/assessment/mistakes` `listAssessmentMistakes`. No cursor or `x-pagination`. `B10AssessmentJdbcController.listMistakes` returns `{items, count}` of every row ordered by `mistake_id`.
- Both operationIds start with `list`, so the p1r gate requires canonical cursor pagination.
- Owner: workflow-service and admin-web for sagas; assessment-service and mistake callers for mistakes.

Forward fix: add `x-pagination` mode `cursor`, one `Cursor`, one `PageSize`, and `ApiCursorPageEnvelope`. Change both services to honor cursor and page size. Update admin recovery and mistake clients to read the envelope. Keep the fail-closed exact-parameter checks.

Checks: test 67 error list loses the six pagination lines; test 72 still fails a mutated list that drops `x-pagination` or puts cursor state in `data`. One service test per list: first page, next cursor, page size bound. Saga must not keep the hardcoded 200 as the public contract.

## RC-C — content lifecycle

Class: two `const` uses are a true OAS 3.0.3 gap. The lexeme/item expansion is a reviewed policy update, or the fragment goes back to the frozen model. Do not delete the `const` ban.

Source: `packages/contracts/fragments/b9/b9-content.openapi.json`, `packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json`, frozen policy in `scripts/audit/p1r-content-lifecycle-check.mjs` (`COMMANDS`, property set, `B9_COMMAND_ONE_OF`). Owner: content-service.

Confirmed:

- `B9ReadingBindingReceipt.bindingStatus.const = "ACTIVE"`
- `B10PlanReplanRequest.confirmImpact.const = true`
- Frozen commands are the 11 version commands. Current enum adds 16 `LEXEME_*` and `ITEM_*` commands.
- Frozen properties are the 10 version fields. Current adds `lexeme`, `pronunciation`, `lexemeId`, `item`, `itemId`, `targetType`, `targetRef`, `cohort`.
- Frozen `oneOf` has 9 branches. `CREATE_DRAFT` and `SAVE_DRAFT` share one branch. Current splits them, so each singleton branch fails the frozen discriminator. Extra lexeme/item branches have no frozen spec. `SCHEDULE_PUBLISH` matches a spec but its forbidden-field set drifted (current requires `schedule`; frozen forbids `targetVersionNumber`, `reasonCode`, `content`, `reviewDecision`, `reviewNote`, `scheduledPublishTaskId`).

Forward fix: replace both `const` values with singleton enums. Then either restore the frozen 9-branch command model, or land one reviewed update of `COMMANDS`, field policy, actor classes, and `B9_COMMAND_ONE_OF` together. `SCHEDULE_PUBLISH`’s new required/forbidden set must be explicit in that review. Do not bump a count.

Unknown: diagnose dumped `oneOf` through `UNPUBLISH`. Later lexeme/item required/forbidden sets were not fully read. The implementation must dump and review them before editing the policy.

Checks: `tests/p1r/p1r-content-lifecycle.test.mjs`. Negative: a new unlisted command and a `const` schema still fail.

## RC-D — M2-001 OpenAPI projection

Class: baseline / governance. Historical pins stay.

Source: `scripts/contracts/compatibility-diff.mjs` `buildM2001OpenApiExpectedProjection`; tests in `tests/p1r/p1r-contract-tooling.test.mjs` and `tests/p1r/p1r-gateway-contract.test.mjs` (421). Owner: packages/contracts promotion, with api-gateway as the boundary owner.

Confirmed: allowance shape is valid; source semantic SHA matches `a154f200…`; health summary and `HealthData.service` const match; both documents have the Gateway root. Projection `constructible: false`, `equalsCurrent: false`. The failing additive node is `components/schemas/B10EnsurePlanResult/properties/explanation`: the parent schema is absent on the M2-001 source, so a property-level add cannot apply. Next constructibility failure: `authorizationClaims` baseline is `permissions`, `roles`, `tenant_id`, `session_id`; approved appends are `adult_gate`, `consent_state`, `phase`, `account_status`; current also has `media_consent` and `content_rights`. `eligibilityClaims` is copied as a whole node when absent, so its extra keys are not the append failure. Cookie SameSite `Lax` → `None` + `Partitioned` is an approved replacement, not the failure. Test 421 actual is `undefined`.

Making the projection constructible is necessary and not sufficient. Collapsed current-vs-baseline diff is hundreds of paths (diagnose capped at 160). Equality with HEAD would rewrite the historical expected digest and would lie about scope `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`.

Forward fix: a successor promotion. Its source is the frozen M2-001 source, or the constructible projection after the two reviewed nodes below. Do not edit `M2001_OPENAPI_SOURCE_SEMANTIC_SHA256` or the historical expected digest `cdcdf214…`.

Reviewed nodes required before a successor can apply:

- Add the whole `B10EnsurePlanResult` schema, not only `explanation`.
- Append `media_consent` and `content_rights` on `authorizationClaims` as reviewed claim names (P1-LIVE-001 / P1-LIVE-012 facts already in the current token). Do not append further claim names in the same change.

Then generate the residual path diff from `66246d5` to HEAD, review it, and freeze that allowlist on the successor. Do not hand-copy hundreds of nodes in the audit. Do not silent-add Gateway execution nodes here; execution count and digest are RC-G and already match.

Checks: projection helper returns an object; successor compare is empty against HEAD; a one-node mutation still breaks; source pin `a154f200…` still matches. Kind `all` tests also need RC-E.

## RC-E — M1-018 event projection

Class: baseline / governance. Do not overwrite the expected semantic or descriptor pins.

Source: `packages/contracts/events/v1/catalog.json`; IAM fragment merged by `buildExpectedCatalog()` in `tests/p1r/p1r-m1-018-iam-compatibility.test.mjs`; runner `scripts/contracts/compatibility-git-baseline.mjs`. Owner: iam-service for the three `iam.*` names; learning-service for `learning.report.ready.v1`; packages/contracts for the successor promotion.

Confirmed: source pin matches. Current catalog SHA `7d2dec99…` does not match expected `5dd1edfa…`. Descriptor actual `7dfe9418…` does not match `c3fa4291…`. Names added since the M1-018 source, none removed: `iam.account.bootstrap.created.v2`, `iam.learning_eligibility.changed.v2`, `iam.policy.security_state_changed.v2`, `learning.report.ready.v1`. Test 731’s CI message is only the projection reason. Test 209 fails the events-only git baseline. Test 238 is the M1-008→M1-018 event promotion (`runM1008PromotionWithMutation`).

Forward fix: successor event promotion whose expected digest is new. Leave `M1018_EVENT_EXPECTED_SEMANTIC_SHA256` and the descriptor pin. `learning.report.ready.v1` is not an IAM v2 static member; give it a learning-service owner on the successor. Do not insert it into the frozen M1-018 IAM projection.

Unknown: this closeout did not hash `buildExpectedCatalog()` against the fragment at the commit that froze the expected digest. The implementation must do that before choosing “fragment drifted after the pin” versus “only later event names”. Either way, do not rewrite the historical digest.

Checks: test 731, test 209, test 238, and the kind `all` tests once RC-D is also in place. A descriptor-set mutation must still fail.

## RC-F — migration inventory and scanner

Class: `fileCount` is a living candidate inventory (`HISTORICAL_CANDIDATE_MIGRATION_INPUT`, task `P1R-M2-004`, not runtime proof). Updating the five drifted counts is the designed gate. The scanner hit is a too-narrow exemption, not an isolation break.

Source: `config/p1r-data-ownership.v1.json` `migrationInventory.existingCollections`; `scripts/audit/p1r-data-ownership-check.mjs` `foreignSchemaReferences`; hit in `services/content-service/.../GradableAssessmentSnapshotController.java`. Owner: platform/contracts for the inventory; content-service owns the controller, but the code change is the checker.

Counts: iam 17 found 18; content 26/33; learning 11/14; assessment 8/12; admin-ops 6/7. Learner 12, media 7, gamification 4, social 2, commerce 2, notification 8, analytics 1, audit 2 did not appear, so they still match. Full current filenames are in `diagnose.txt`. The constant is `ASSESSMENT_SERVICE = "assessment-service"` (hyphen). The regex matches the identifier `ASSESSMENT_SERVICE.equals`. The existing exemption skips only a quoted `*_service` string whose next token is a Java call.

Forward fix:

- Set the five counts to 18, 33, 14, 12, 7 and record the new `V*.sql` names. Leave the other services. Do not call this runtime verification.
- Extend the exemption to a bare identifier whose next token is `.equals(` or `.equalsIgnoreCase(`. Add a negative test that `assessment_service.attempt` and `ASSESSMENT_SERVICE.attempt` still fail.

Unknown: the exact extra filenames versus the commit that last set each `fileCount` were not git-diffed. Use the diagnose lists. Do not guess that iam’s extra is only `V19`.

Checks: `tests/p1r/p1r-data-ownership.test.mjs`. One SQL-shaped negative fixture must still fail.

## RC-G — Gateway counts and account-deletion reason

Class: stale test summary, plus a reviewed lock of the real public/internal residuals. Not permission to add more routes.

Live `validateGatewayContract` summary: route rules 75, public 404 covered 404, coverage errors 0, execution plans 75, projections 209, available 226, unavailable 178, digest `f6e9cb48…` matches the freeze, internal 70, external-denied internal 70, canonical projection matches. Checker errors are only public 365→404, internal 66→70, and `iam-account-deletions`.

Checker comments already moved route/execution 56→75 and left public drift open. Test 419 still expects route 56, public 365, plan 56, projections 153, available 170, unavailable 195, internal 62. Test 442 expects public 365, routes 56, internal 62. Test 428 matches `/route execution plan count must be 56/` while the checker says `must be 75`.

Public added since the M2-001 source blob, removed empty (39, 365+39=404): `listAdminLearnerSubjects`, `getAdminLearnerAssessments`, `getAdminLearnerPlans`, `getAdminLearnerProfile`, `getAdminLearnerSrs`, `listAdminRiskCases`, `listUnfinishedSagas`, `readWorkflowSaga`, `listAssessmentMistakes`, `resolveB9LearnerContentSubstitute`, `listB8LockedAccounts`, `readMediaAssetTasks`, `readPrivacyExportStatus`, `readPrivacyExportDownload`, `getLearningReportShare`, `importB9ContentBatch`, `validateB9ContentAuto`, `sendAdminLearnerCommand`, `sendAdminLearningCommand`, `fileAdminRiskCase`, `decideAdminRiskCase`, `evaluateAdminRiskRules`, `requestWorkflowRecovery`, `approveWorkflowRecovery`, `executeWorkflowRecovery`, `rejectWorkflowRecovery`, `compensateWorkflowSaga`, `issueAssessmentVariant`, `verifyAssessmentMistake`, `retestB10PlacementSession`, `ensureB10LearningPlan`, `replanB10LearningPlan`, `revokeLearningReportShare`, `issueLearningReportShare`, `registerMediaAsset`, `retryMediaAsset`, `upsertMediaSubtitle`, `mintMediaUploadUrl`, `activateMediaAsset`.

Internal since that source is 8, removed empty. Checker comments already count 4 of them inside 66: learner target pin, placement-bank plan-items, learning plans current-view, placement-bank sealed. The 66→70 residual is the other four: `getIamLearningConsentFact`, `matchB10AssessmentAttemptBinding`, `bindB9PublishedReading`, `scoreB10AssessmentContentSnapshot`. Verify HEAD internal minus these four is still 66 before changing the constant. If it is not, stop. Do not bump a bare integer.

`iam-account-deletions` is still in `EXPECTED_UNAVAILABLE_EXECUTION_REASONS` as `iam_owner_controller_mapping_not_present`. The fragment has `defaultReason` `no_exact_canonical_execution_target` and three AVAILABLE projections (create, status, cancel) on `IamAccountDeletionController`. The checker cannot mix that with the unavailable map (`projections.length === 0` and the old reason). The old reason is false: the controller exists. `POST` create still throws 503. GET status and POST cancel are real.

Forward fix:

- Lock public expected to 404 only together with the 39 operationIds. Lock internal expected to 70 only together with the 4 operationIds, after the verification above.
- Point tests 419 and 442 at the post-fix summary. Fields that already match and should stay: routes 75, plans 75, projections 209, available 226, digest `f6e9cb48…`, coverage errors 0. Re-read `unavailableExecutionOperationCount` after the reason edit. Do not assume it leaves 178.
- Test 428: expect `must be 75`. Emptying `routeExecutions` must still fail. Do not assert the public-drift string, and do not treat the register route in that dirty failure as a request to close registration.
- Remove `iam-account-deletions` from the unavailable-reason map only. Leave the three projections and the 503 on create. Do not change the execution-target digest unless a projection field actually changes. Add a source assertion that create still throws 503.

Owner: api-gateway / packages/contracts for the checker and fragment; iam-service for the 503 remaining true.

Checks: `tests/p1r/p1r-gateway-contract.test.mjs` 419, 420, 428, 442. Negative: one extra public operationId fails the 404 lock; restoring the old deletion reason fails; a wildcard projection still fails.

## RC-H — withheld frontend routes

Class: true gap. Do not delete withheld reasons.

Test 457 actual callers:

- `apps/learner-web/src/api/b11.ts` `/api/v1/speaking/recordings` (rule `speaking-recordings`, owner media-service, reason `canonical_media_owner_conflicts_with_current_learning_controller`)
- `apps/learner-web/src/api/b11.ts` `/api/v1/sync` (rule `sync-domain`, owner learning-service, reason `canonical_learning_owner_conflicts_with_current_notification_controller`)
- `apps/learner-web/src/api/b10.ts` and `apps/mobile/src/api/b10.ts` `/api/v1/reading` (rule `reading-domain`, owner assessment-service, reason `canonical_assessment_owner_conflicts_with_current_learning_or_content_controller`)
- `apps/learner-web/src/api/b11.ts` `/api/v1/speaking` (rule `speaking-domain`, owner assessment-service, reason `canonical_assessment_owner_conflicts_with_current_learning_controller`)

Owner: learner-web and mobile for the calls. Gateway owner change only with the service that actually serves the path (media, learning, assessment, notification, content).

Forward fix: for each call, read the client function and either point it at an already available canonical path, or add one exact projection whose owner matches the controller. Do not drop the reason string. Do not add these paths to the RC-G public-count list unless they are new operationIds; the 39-list is already the full public residual.

Checks: test 457 empty offender list; tests 458–461 still pass. A comment that mentions a withheld path must not count as a call (458 already checks that).

## RC-I — learning canonical routes

Class: reviewed inventory update. Keep the exact-match check.

Source: `config/p1r-learning-loop-contract.v1.json` `compatibilityPromotion.canonicalRoutes`; checker `scripts/audit/p1r-learning-loop-contract-check.mjs` `checkCanonicalRoutes`. Diff is only added `POST:/api/v1/learning/plans:ensure` and `POST:/api/v1/learning/plans:replan`. Removed none. Owner: learning-service.

OpenAPI rows already say owner `learning-service`, permission `learning.plan.write`, bearer, `x-idempotency.required true`, key `Idempotency-Key`, PEP `learning-service-local`, default DENY. Request schemas `B10EnsurePlanRequest` and `B10PlanReplanRequest`. Response schemas `B10EnsurePlanResult` and `B10PlanReplanResult` (inside the success envelope). OperationIds `ensureB10LearningPlan` and `replanB10LearningPlan`.

Forward fix: add two policy rows, ids matching `B10-[A-Z0-9-]+`, idempotency `REQUIRED`, those schema names. The checker also requires `additionalProperties: false` on the request schema and `x-contract.canonical: true`. Satisfy those. Do not weaken the route-key set. `confirmImpact` `const` is RC-C; changing it to `enum: [true]` does not replace this inventory update.

Checks: `tests/p1r/p1r-learning-loop-contract.test.mjs` 632 and 633. A third canonical `/api/v1/learning/` route still fails the exact match.

## RC-J — adult-gate test order

Class: stale test. The boundary order is already correct.

Source: `tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs` uses `indexOf('iam.adult_gate.birth_year_invalid')`, which hits the null `birthYear` throw first. Controller `IamProviderBoundaryController.adultGate`: null birth year throws that code, then `int age = currentYear - request.birthYear()`, then `if (age < 0 || age > 150)` throws the same code, then `TrustedAgeEvidence.fromServerAttestation`. `TrustedAgeEvidence` still rejects `age < 0 || age > 150`. Test 739 passed. Owner: iam-service test only.

Forward fix: assert the `if (age < 0 || age > 150)` branch sits after the age subtraction and before `fromServerAttestation`, and that this branch uses `iam.adult_gate.birth_year_invalid`. Do not move the null check. Do not delete the range guard. Do not close registration.

Checks: tests 738 and 739.

## Order for the implementation root

1. RC-J (test locator only).
2. RC-F (inventory counts and scanner exemption).
3. RC-A, then RC-B (same API fixture; pagination needs real service behavior).
4. RC-C consts, then the reviewed command policy. RC-I route rows can land with the replan schema enum fix.
5. RC-G count lock and deletion-reason removal. No new execution nodes.
6. RC-H caller retarget or one exact projection per call.
7. RC-D and RC-E successor promotions last, after the contract shape to freeze is known.

Selected files only. Do not re-run the full 1481 as the edit loop. The final CI run is a separate root decision.

## Not run

- Full 1481 locally.
- Docker, JVM, browser, listeners, dependency installs, Git writes, source edits.
- This closeout did not re-run diagnose or re-read checkers.
- GitHub was not re-queried. The second of the two red jobs was not opened here. Subsequent steps after the p1r failure were NOT_RUN.
- Not hashed: `buildExpectedCatalog()` versus the fragment at the M1-018 digest freeze.
- Not diffed: extra Flyway names versus the commit that last wrote each `fileCount`.
- Not dumped: B9 lexeme/item `oneOf` branches after `UNPUBLISH`.
