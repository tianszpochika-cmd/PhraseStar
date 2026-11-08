# G460 RC-B pagination rework

Date: 2026-11-08  
Checkout: detached `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`  
Git/index/branch: unchanged (no add/commit/checkout/push)  
OUTPUT: `/tmp/grok-mobile-resume-pagination-rework-460`  
CLI: Grok only. No subagents/Codex/DSH.

Root review inputs: `/tmp/grok-mobile-resume-pagination-review-449/{REPORT.md,reproduction-results.json,reproduce.mjs}` and `pagination-442-root-review/REWORK.json` (`REWORK_REQUIRED`).

This is a rework of frozen G442 pagination against independent G449 failures. It does not accept G442. It does not claim DoD, deployment, native, or live runtime.

## Snapshot before edits

Taken at `2026-11-08T14:27:09Z` into `OUTPUT/snapshot/`:

- `dirty-hashes.json` (42 dirty/untracked paths)
- `exact-dirty.diff` (G442 + partial G448 vs `ed6`)
- `g442-freeze-vs-tree-before.json`: ok=26 mismatch=2 missing=0 (`CHANGELOG.md`, `packages/contracts/openapi/v1/openapi.json` from G448)

G448 share/fragments/generated/config/B25/V15 were snapshotted, then left byte-for-byte. `OUTPUT/g448-preserve.json` `all_match: true` (19/19). B25 controller was not edited.

## What changed (G449 → code)

### 1. Assessment feed fail-closed (G449-1)

`HttpAssessmentMistakeFeed.list` no longer returns a prefix or empty list on later non-200, timeout, or parse failure.

A walk throws `AssessmentMistakeFeedException` when:

- bearer missing (401)
- first or later HTTP status is not 200 (status preserved)
- body is not JSON / not a page
- `hasMore` with an empty page (no progress)
- duplicate `itemId` in the walk
- repeated / non-progress `nextCursor`
- page budget exhausted while `hasMore` is still true (budget 10_000, throw, not a silent 10_000-fact return)

`parsePage` no longer treats a broken body as `Page.empty()` / end of book.

`AssessmentMistakeQueueProjector.project` calls `list()` first and writes only after a completed walk. On feed failure it maps 401/403 through, 504/408 to 504, 503 to 503, other walk failures to 502, and does not INSERT. B3/B25 learner GETs already call `project()`; `ResponseStatusException` bubbles. B25 share mint/revoke bytes unchanged.

### 2. Admin walker fail-closed (G449-2)

`listAllUnfinishedSagaIds` no longer stops at 50 pages and returns a 5,000-id prefix.

It walks until `hasMore` is false. It throws on repeated cursor, duplicate id, empty page with `hasMore`, missing cursor with `hasMore`, or `UNFINISHED_SAGA_PAGE_BUDGET` (10_000) with `hasMore` still true.

`AdminRecoveryView.load` assigns `sagas` only after that function returns. On error it clears `sagas` and stays on the error alert. Ready is not set for a prefix. The 待恢复 list is inside the non-error branch.

### 3. Saga keyset `started_at, saga_id` (G449-3)

Unfinished SQL and in-memory slice order by immutable `started_at, saga_id`. Status updates still bump `updated_at` (`ON UPDATE`) and do not reinsert a row into a later page.

Cursor encode uses six-digit UTC microseconds (`yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'`), truncated to micros, same value the JDBC `Timestamp` bind uses.

`SagaRecord` gained `startedAt`. A 9-arg convenience constructor keeps G442 fake stores compiling without touching `SagaControllerTest` / `SagaServiceTest` bodies.

No schema migration. `idx_saga_status (status, updated_at)` is unchanged. Follow-up index on `(status, started_at, saga_id)` is not in this job.

### 4. Split deploy (G449-4)

Public/internal handlers still default `pageSize=20` when omitted. Frozen admin walker and the feed send `pageSize=100` and read `meta`. They must ship with these handlers. An old one-shot caller still sees 20 rows. That is a deployment concern. This job does not claim backwards bundle acceptance.

Assessment owner filters (`tenant_id` + `subject_id`), malformed cursor 400, max `pageSize` 100, and permission boundaries were not relaxed.

## Contracts

Not regenerated. `merge-b1-fragments.mjs --check` exit 0 (28 OpenAPI fragments, 442 routes). `generate-contracts.mjs --check` exit 0 (5 generated files). OpenAPI/TS digests unchanged from the G460 start snapshot (G448 bytes). Pagination API schema was sufficient; no fragment edit.

## Tests run

| Check | Exit | Result |
| --- | --- | --- |
| `node --test apps/admin-web/tests/recovery-sagas.test.mjs` | 0 | 9/9 pass: envelope, 2-page walk, **5100 ids / 51 pages**, **5100 pages**, repeated cursor, duplicate id, budget+hasMore, later HTTP throw, view ready-after-complete and error clears sagas |
| `node --test tests/p1r/p1r-api-contract.test.mjs` | 0 | 12/12 pass; signed-access singleton and required share headers still in this file |
| `merge-b1-fragments.mjs --check` | 0 | 442 routes |
| `generate-contracts.mjs --check` | 0 | 5 generated files |
| Maven learning-service `-Dtest=HttpAssessmentMistakeFeedTest,AssessmentMistakeQueueProjectorTest` | 0 | **16 tests, 0 fail**. Real JDK `HttpServer` on `127.0.0.1:ephemeral`: complete walk, first 401/403, later 401/500, malformed later page, repeated cursor, budget+hasMore, timeout 504. Projector 403/later 401: no `update` / no `queryForObject` |
| Maven workflow-service first invocation | 1 | 26 tests, **2 failures** (see below), then source fix |
| Maven workflow-service after test fix | NOT_RUN | session blocked a further JVM after the first serialized pair |

Maven: `JAVA_HOME=/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home`, `/Users/Admin/.local/tools/maven/bin/mvn`, `-o`, `maven.repo.local` overlay under OUTPUT because `~/.m2` is not writable in this sandbox. Default file-lock factory. **No** `-Daether.syncContext.named.factory=noop`. No `~/.m2` lock deletes. No `learning.report-share.jdbc.integration=true`. No `workflow.jdbc.integration=true`. Overlay directory removed after the runs.

Learning HTTP servers lived only inside those unit tests and were `stop(0)` in `finally`.

Workflow first log (`maven-workflow-paging.log`):

- `JdbcSagaStorePaginationTest` passed (`ORDER BY started_at, saga_id` and keyset bind)
- `UnfinishedSagaPagingTest.cursorPrecisionRoundTripsMicroseconds` passed (the class had 4 tests, 1 failure)
- Failures were `unfinishedWalkDoesNotDuplicateWhenUpdatedAtMoves` and `mutableUpdatedAtDoesNotDuplicateASagaAcrossPages`

Cause: after the last page (`hasMore=false`, `nextCursor=null`) the tests requested another page with a null cursor, which is first-page semantics, so `saga-a` appeared again. That is not a keyset regression. Tests now stop when `hasMore` is false and assert `a,b,c` once. **Those two tests were not re-executed.**

## Residual CI

Not a full CI run. Not a clean-tree gate.

- P1R governance tests in this tree: 12/12 pass on the G448 contract set. Signed-access remains the sole optional-write exception. Share mint/revoke still require `Idempotency-Key`. Fail-closed upload-url still has no `x-idempotency`.
- Contract route count still 442. Digests were not edited to green anything.
- Frozen git-baseline compatibility breaks on `ed6a1e57` (`m2-001.gateway-root`, `m2-001.projection`, `m1-018.change-descriptors`, `m1-018.projection`) are pre-existing and not from this rework.
- G442 pagination candidate remains unaccepted; this rework is a new dirty delta on the same checkout.

## NOT_RUN

- Live IAM/Gateway/MySQL/Kafka/Docker/browser/device/native
- Learning/workflow process listeners
- JDBC integration tests
- Workflow Maven after the null-cursor test fix
- Full `validate-contracts` CI job / remote CI
- Deployment, Helm, GitOps
- Backwards bundle of old admin/feed with new handlers

Root launches live leases.

## Files touched after the start snapshot

Rework only:

- `apps/admin-web/src/api/recovery.ts`
- `apps/admin-web/src/views/AdminRecoveryView.vue`
- `apps/admin-web/tests/recovery-sagas.test.mjs`
- `services/learning-service/src/main/java/com/englishflow/learning/adapter/http/HttpAssessmentMistakeFeed.java`
- `services/learning-service/src/main/java/com/englishflow/learning/adapter/http/AssessmentMistakeQueueProjector.java`
- `services/learning-service/src/main/java/com/englishflow/learning/adapter/http/AssessmentMistakeFeedException.java` (new)
- `services/learning-service/src/test/java/com/englishflow/learning/adapter/http/HttpAssessmentMistakeFeedTest.java`
- `services/learning-service/src/test/java/com/englishflow/learning/adapter/http/AssessmentMistakeQueueProjectorTest.java`
- `services/workflow-service/src/main/java/com/englishflow/workflow/domain/SagaStore.java`
- `services/workflow-service/src/main/java/com/englishflow/workflow/domain/UnfinishedSagaPaging.java`
- `services/workflow-service/src/main/java/com/englishflow/workflow/adapter/jdbc/JdbcSagaStore.java`
- `services/workflow-service/src/test/java/com/englishflow/workflow/domain/UnfinishedSagaPagingTest.java`
- `services/workflow-service/src/test/java/com/englishflow/workflow/adapter/jdbc/JdbcSagaStorePaginationTest.java`
- `services/workflow-service/src/test/java/com/englishflow/workflow/adapter/http/SagaUnfinishedPaginationTest.java`
- `CHANGELOG.md` (added `[RC-B-PAGINATION-REWORK-20261108]`; RC-A line kept)

G442 freeze vs tree after: ok=15 mismatch=13 missing=0. The 13 are the rework set plus G448 `CHANGELOG.md` / `openapi.json`. Assessment handler, mistake paging, saga HTTP controller, and G442 generated TS still match the freeze.

## Evidence paths

- `snapshot/` start pins
- `exact-new.diff` rework vs freeze/HEAD origins
- `working-tree-vs-HEAD.diff` full dirty tree including G442+G448
- `source-pins.json` `g448-preserve.json` `g442-freeze-vs-tree-after.json`
- `maven-learning-feed.log` `maven-workflow-paging.log`
- `p1r-api-contract.test.log` `merge-check.log` `generate-check.log`

No credentials, tokens, or personal data in this directory.
