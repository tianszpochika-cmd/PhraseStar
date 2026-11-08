# RC-G and RC-I route policy locks

Implemented only reviewed RC-G and RC-I from the G436 plan. AGENTS.md, STATUS, and CURRENT-HANDOFF still place this checkout on iteration 2 / `dev`. These two items are existing P1R CI guards. They do not open an R1 card and they do not move the 115/115 historical signoff.

No full `pnpm test:p1r` run, no route signoff, and no claim that the contracts/data job is green. The M2-001 projection failure remains.

## What was verified before the locks

Read-only `git show` of `66246d5b4a68a988a9af4ece68a446640b123812:packages/contracts/openapi/v1/openapi.json` against HEAD `packages/contracts/openapi/v1/openapi.json`. No index, branch, or checkout write.

Public operations: source 365, HEAD 404, added 39, removed none. The 39 operationIds are exactly the PLAN list. The operationId set that remains after removing those 39 equals the source public operationId set. Digest of that sorted set: `7a609b793e5372d7f65a352f08f38929922caf03c849735a56e0ecc7647f721c`.

Every one of the 39 has exactly one public route rule. Thirty have an explicit `x-owner` or `x-contract.owner` that matches that rule's `upstreamOwner`. Nine have no explicit owner field and no conflicting owner. Their single rule is the mapping:

| operationId | path | rule | rule owner |
| --- | --- | --- | --- |
| listUnfinishedSagas | `/api/v1/admin/recovery/sagas/unfinished` | admin-recovery | workflow-service |
| readWorkflowSaga | `/api/v1/admin/recovery/sagas/{sagaId}` | admin-recovery | workflow-service |
| requestWorkflowRecovery | `/api/v1/admin/recovery/recoveries` | admin-recovery | workflow-service |
| approveWorkflowRecovery | `/api/v1/admin/recovery/recoveries/{recoveryId}/approve` | admin-recovery | workflow-service |
| executeWorkflowRecovery | `/api/v1/admin/recovery/recoveries/{recoveryId}/execute` | admin-recovery | workflow-service |
| rejectWorkflowRecovery | `/api/v1/admin/recovery/recoveries/{recoveryId}/reject` | admin-recovery | workflow-service |
| compensateWorkflowSaga | `/api/v1/admin/recovery/sagas/{sagaId}/compensate` | admin-recovery | workflow-service |
| readPrivacyExportStatus | `/api/v1/privacy/export/{exportId}` | privacy-domain | learner-service |
| readPrivacyExportDownload | `/api/v1/privacy/export/{exportId}/download` | privacy-domain | learner-service |

Those nine owner fields were left as they are. Filling them would edit OpenAPI and would sit on the RC-D projection, which this change does not touch.

Internal operations: source 62, HEAD 70, added 8, removed none. Four of the eight are already inside the frozen 66: `pinB9LearnerTargetContent`, `getPlacementBankPlanItems`, `getB10LearningPlanView`, `getPlacementBankSealedSnapshot`. HEAD minus the other four is 66. Those four are the lock:

| operationId | method | path | owner |
| --- | --- | --- | --- |
| getIamLearningConsentFact | GET | `/internal/v1/iam/principals/{principalId}/learning-consent` | iam-service |
| matchB10AssessmentAttemptBinding | POST | `/internal/v1/assessment/attempts/{attemptId}/binding` | assessment-service |
| bindB9PublishedReading | POST | `/internal/v1/content/admin/reading-bindings` | content-service |
| scoreB10AssessmentContentSnapshot | POST | `/internal/v1/content/assessment-snapshots/{contentVersionId}/score` | content-service |

`bindB9PublishedReading` has no permission field. The lock records the operationId and leaves that contract as it is. Internal operations are outside the public route-rule table, so `routeRuleCount` is 0 for them.

The full rows are in `exact-39-public.json` and `exact-4-internal.json`.

## RC-G

`scripts/audit/p1r-gateway-contract-check.mjs` now locks public 404 as frozen 365 plus the 39 operationIds, and internal 70 as frozen 66 plus the four operationIds. Each lock also pins the SHA-256 of the sorted remainder operationIds, so replacing an old id while keeping the count fails. The policy field `baselineOperationCount` stays 66 in both the gateway fragment and the canonical projection. The fragment was not edited, so the canonical projection equality and the execution-target digest stay put.

`iam-account-deletions` was removed from `EXPECTED_UNAVAILABLE_EXECUTION_REASONS` only. The route rule, the three projections (`deletion-request`, `deletion-status`, `deletion-cancel`), and `defaultReason: no_exact_canonical_execution_target` stay. `IamAccountDeletionController.request` still throws `HttpStatus.SERVICE_UNAVAILABLE` before any success envelope.

Re-read after that reason edit: `unavailableExecutionOperationCount` is 178. Available stays 226. Projections stay 209. Route rules stay 75. Execution plans stay 75. Digest stays `f6e9cb48732fd64abd8a89f5f7d9c1dd6892981c13722a0def638343ea5fb80d`.

M2-001 source commit `66246d5b4a68a988a9af4ece68a446640b123812`, scope `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`, and the execution digest constant were left in place. `compatibility-diff.mjs` was not edited, so source semantic `a154f2004f06e5da096abea630855152fac9e87224ad48565a38e6010ab9416b` is untouched.

## RC-I

`config/p1r-learning-loop-contract.v1.json` gained exactly two canonical rows:

- `B10-PLAN-ENSURE` POST `/api/v1/learning/plans:ensure`, operationId `ensureB10LearningPlan`, request `B10EnsurePlanRequest`, response `B10EnsurePlanResult`
- `B10-PLAN-REPLAN` POST `/api/v1/learning/plans:replan`, operationId `replanB10LearningPlan`, request `B10PlanReplanRequest`, response `B10PlanReplanResult`

Both rows use owner `learning-service`, permission `learning.plan.write`, security `bearerAuth`, and idempotency `REQUIRED`. The B10 fragment already has those operationIds, bearer security, `x-contract.canonical: true`, `x-contract.owner: learning-service`, `x-authorization.requiredPermission: learning.plan.write`, PEP `learning-service-local`, default DENY, `x-idempotency.required: true`, key `Idempotency-Key`, and `additionalProperties: false` on both request schemas. `confirmImpact` `const: true` was left for RC-C.

Same-owner checker edit, required: `FROZEN_POLICY_SHA256` is the digest of this whole policy document. The two rows change that digest from `d1e467d8697f9f873c5ac3b45fa7c5a39085c9b975dfd3abbffac251d5847973` to `db9871277991f8fcf072446de1a6c985f07ad6e3a6c4bdb4406014cb50c9df5c`. `checkCanonicalRoutes` still exact-matches the sorted `method:path` set. A third canonical `/api/v1/learning/` route fails that match. This digest is the M1-013 policy pin. It is separate from the M2-001 semantic pin, the M1-018 event pins, and execution digest `f6e9cb48…`.

`tests/p1r/p1r-learning-loop-generated-types.test.mjs` counted the same `canonicalRoutes` array as 11. It now requires the previous 11 operationIds plus the two reviewed rows, length 13.

## Tests

Scoped `node scripts/dev/run-node-tests.mjs` only.

| File | Result |
| --- | --- |
| `tests/p1r/p1r-gateway-contract.test.mjs` | 43 tests, 42 pass, 1 fail, exit 1 |
| `tests/p1r/p1r-learning-loop-contract.test.mjs` | 78 tests, 78 pass, exit 0 |
| `tests/p1r/p1r-learning-loop-generated-types.test.mjs` | 2 tests, 2 pass, exit 0 |

The gateway failure is the pre-existing RC-D assertion `buildM2001OpenApiExpectedProjection(...)` deep-equal to the current canonical document. Actual is `undefined`. That test was not edited into a pass.

New negatives that passed: extra public operationId (`expected 404, got 405`); internal inventory replacing `getIamLearningConsentFact`; omitted `iam-account-deletions` projections; restored `iam_owner_controller_mapping_not_present`; public create still throws 503 with the three projections left in place; third unlisted canonical learning route.

## Preserved bytes

Preexisting dirty SHA-256 values are identical before and after:

- `.github/workflows/ci.yml`
- `config/toolchain-baseline.json`
- `scripts/audit/p1r-evidence-gate.mjs`
- `scripts/audit/rebind-manifests.mjs`
- `scripts/runtime/provision-kafka-topics.mjs`
- `tests/p1r/p1r-evidence-gate.test.mjs`
- `tests/p1r/p1r-kafka-topic-provision-parser.test.mjs`

`node_modules` remains a symlink to `/Users/Admin/Desktop/work/cloudstudy/node_modules` (mode 41408, size 49). The snapshot at `ci-452-preexisting` still matches its own `MANIFEST.json`. B147/B148/B149 source was not in the dirty set and was not edited.

Changed files are the six sources in `SHA256-MANIFEST.txt`. `exact.diff` is the byte diff of those six against the pre-edit copies.
