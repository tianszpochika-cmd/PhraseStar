# RC-B pagination implementation

Date: 2026-11-08  
Checkout: detached `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`  
Git/index/branch: unchanged (no add/commit/checkout)  
Scope: RC-B only. RC-A was not implemented.

## What changed

Two owner lists now honor `cursor` / `pageSize` and return canonical `ApiCursorPageEnvelope` + `ApiCursorPageMeta`.

| Operation | Fragment SSOT | Owner | Data after change |
| --- | --- | --- | --- |
| `GET /api/v1/admin/recovery/sagas/unfinished` `listUnfinishedSagas` | `packages/contracts/fragments/b26-workflow-recovery.openapi.json` | workflow-service | `data: string[]` saga ids + `meta` |
| `GET /api/v1/assessment/mistakes` `listAssessmentMistakes` | `packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json` | assessment-service | `data: { items, count }` of the page + `meta` |

Both declare `x-pagination.mode=cursor`, exactly one `#/components/parameters/Cursor` and `PageSize`. Canonical merge/generate wrote:

- `packages/contracts/openapi/v1/openapi.json`
- `packages/contracts/generated/openapi.ts`
- `packages/api-client/src/generated/index.ts`

There is no `packages/api-types` package. The normal generator emits the two generated trees above.

## Runtime

- **workflow-service**: `SagaController.unfinished` no longer returns a fixed 200-row `List<String>`. `SagaStore.unfinishedPage` filters unfinished statuses, orders by `updated_at, saga_id`, keyset-pages, and derives `nextCursor` from the last returned row. Default page size 20, max 100. Invalid cursor/pageSize → 400.
- **assessment-service**: `B10AssessmentJdbcController.listMistakes` uses `JdbcAssessmentMistakeList`. Filters `tenant_id` + `subject_id` before `ORDER BY mistake_id`. Probe `LIMIT pageSize+1`. Invalid cursor/pageSize → 400 before JDBC.
- No cross-service SQL.

## Callers

- `apps/admin-web/src/api/recovery.ts` reads `{ data, meta }`, exposes `sagaIds/hasMore/nextCursor/pageSize`, walks pages in `listAllUnfinishedSagaIds`.
- `AdminRecoveryView.vue` uses the walker.
- `HttpAssessmentMistakeFeed` (only first-party caller of `/internal/v1/assessment/mistakes`) parses envelope meta and walks pages at `pageSize=100`.
- Mobile `listMistakeBook` still calls `/mastery/mistakes` (`listB2Mistakes`, learning-service). That is a different operation and was not retargeted.

## Compatibility vs ed6 (`ed6a1e57`)

Incremental working-tree delta only. Do not attribute the frozen CI baseline 4-break set (`m2-001.gateway-root`, `m2-001.projection`, `m1-018.change-descriptors`, `m1-018.projection`) to this job.

**Saga list — unavoidable envelope wrap**

- Before: HTTP 200 body was a raw `string[]`.
- After: `{ data: string[], meta: ApiCursorPageMeta }`.
- Migration: read `data` as the id array; use `meta.nextCursor` / `meta.hasMore` / `meta.pageSize`. Admin recovery already unwrapped `data` and now also reads meta.

**Mistake list — additive on data**

- Before: `{ data: { items, count } }` of the full owner table, no meta, no bound.
- After: same `data.items` / `data.count` (count is the page length), plus canonical `meta`. Cursor state is not copied into `data`.
- Feed and any `{ data: { items } }` reader keep working on a single page; they must follow `nextCursor` to exhaust the owner set.

No frozen digest, source pin, or allowance file was edited.

## Tests run

| Check | Result |
| --- | --- |
| `merge-b1-fragments.mjs` (write + check) | pass, 442 routes |
| `generate-contracts.mjs` (write + `--check`) | pass, 5 generated files |
| workflow-service focused tests | pass (`UnfinishedSagaPagingTest`, `SagaUnfinishedPaginationTest`, `SagaControllerTest`, `SagaServiceTest`, `SagaCompensationExecutorTest`, `JdbcSagaStorePaginationTest`) |
| assessment-service focused tests | pass (`MistakeListPagingTest`, `B10MistakeListPaginationTest`, `AssessmentJdbcAuthorizationBoundaryTest`) |
| `HttpAssessmentMistakeFeedTest` | pass |
| `apps/admin-web/tests/recovery-sagas.test.mjs` | pass |
| `p1r-api-contract.test.mjs` test 72 (list fail-closed) | pass |
| `p1r-api-contract.test.mjs` tests 67, 70, 73 | fail, RC-A residual only (below) |

Maven used `JAVA_HOME=/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home` and `/Users/Admin/.local/tools/maven/bin/mvn` with `-o` and `-Daether.syncContext.named.factory=noop`. No Docker, live DB, browser, listeners, or `node_modules` mutation.

Service tests covered first page, next cursor, empty, exact-page boundary, invalid cursor, invalid pageSize, and owner isolation (mistakes) / unfinished-status filter (sagas).

## Residual P1R errors (RC-A, outside this job)

Test 67/70 remaining errors (pagination lines are gone):

1. `POST /api/v1/learning/reports/{reportType}/shares is not the sole allowed signed-access idempotency exception`
2. `POST /api/v1/learning/reports/{reportType}/shares optional idempotency needs x-p1r-idempotency-exception`
3. `POST /api/v1/learning/report-shares/{ref}/revoke must reference a required Idempotency-Key header`
4. `POST /api/v1/media/assets/{assetId}/upload-url needs x-idempotency`
5. `exactly one signed-access idempotency exception is required; found 2`

Test 73 still fails because the live document already has 2 optional-write exceptions; the mutation expects `found 2` and now sees `found 3`. See `RC-A-DECISION.md`. Public `POST /api/v1/auth/register` remains available to 18+. Media upload success stays closed. No new card counts. Tracing gaps on other recovery/saga writes were left as-is.

## Not claimed

Deployment, native, live DB, DoD, or a green full canonical gate.
