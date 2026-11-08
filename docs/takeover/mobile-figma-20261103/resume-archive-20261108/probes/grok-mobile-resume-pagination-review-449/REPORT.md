# G449 review of the frozen G442 pagination candidate

Read-only review against `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`. The frozen tree is the 28-file candidate at `pagination-442-reviewed-source`. All 28 manifest SHA-256 values match. No product source, Git state, or G442 report was changed. This review does not accept the candidate.

The two behaviors Root named are real. The mistake-feed prefix is a regression against `ed6a1e57`. The 50-page saga stop is a real silent truncation; for a stable set of 5,000 or fewer it shows more rows than the old 200-row cap, and it still drops `hasMore`. Ordering unfinished sagas by `updated_at` is a separate regression: a status update returns a saga that was already listed.

## Findings

### G449-1. Later mistake pages can succeed as a prefix. Regression.

`HttpAssessmentMistakeFeed.list` walks at most 100 pages. A non-200 after the first page returns the facts already collected (`HttpAssessmentMistakeFeed.java` 58-60). A thrown timeout does the same when the list is non-empty (70-72). A body that does not parse becomes `Page.empty()` with `hasMore` false (80-109), so the loop treats that body as the end of the book.

`ed6a1e57` issued one GET and returned an empty list on non-200, throw, or parse failure (`HttpAssessmentMistakeFeed.java` 37-56). The owner SQL had no `LIMIT`, so a 200 was the whole owner set.

Fixture, 150 ZERO mistakes, page size 100:

| Later page | Returned facts | Tail of 50 |
| --- | --- | --- |
| HTTP 401 | 100 | omitted |
| HTTP 500 | 100 | omitted |
| malformed JSON | 100, loop ends as a normal last page | omitted |
| same `nextCursor` repeated | 10,000 rows, 100 unique ids, 100 calls | omitted |
| throw after page 1 | 100 | omitted |
| HTTP 403 on page 1 | 0 | pre-existing empty result |

`AssessmentMistakeQueueProjector.project` inserts whatever `list()` returns and does not know the walk stopped early (`AssessmentMistakeQueueProjector.java` 34-67 at `ed6a1e57`). Both learner routes call that projector and then read `b3_learning_interaction` as HTTP 200:

- `B3LearningJdbcController` `GET /mastery/mistakes` (412-414)
- `B25LearningJdbcController` `GET /mistakes/queue` (640-644)

A learner with 150 assessment mistakes can see a 200 queue of the first 100. The assessment 401 never reaches that response. The page-1 empty result on 401/403 was already in `ed6a1e57`. The new code keeps it, and adds the prefix case.

The assessment handler itself does not do this. `listMistakes` calls `principal()` before the query and maps only `ASM_CURSOR_INVALID` and `ASM_PAGE_SIZE_INVALID` to 400 (`B10AssessmentJdbcController.java` 560-581). An empty owner page is a 200 with `items: []` after authentication.

Rework: fail the walk on non-200, transport failure, parse failure, a repeated cursor, or a budget exit while `hasMore` is true. `project()` inserts only a completed walk. A 401 or 403 must fail the learner read. Leave invalid cursors at 400.

### G449-2. The saga walker stops at 50 pages and the screen shows ready. Signaling defect.

`listAllUnfinishedSagaIds` (`apps/admin-web/src/api/recovery.ts` 119-128) requests `pageSize=100` at most 50 times and returns the concatenated ids when the loop ends. It does not look at `hasMore` after the 50th page. `AdminRecoveryView.vue` 47-49 stores that array and sets `ready` when it is non-empty. The empty copy at line 249 is only for a zero-length array.

Fixture: 5,100 stable ids, 100 per page, every response 200. The walker made 50 requests, returned the oldest 5,000, and left `saga-5000-…` out. The 50th response still had `hasMore: true` and `nextCursor`. A second-page HTTP 400 throws out of `adminClient.request`; the walker does not return the first page. That path stays an error alert. Status 403 stays the permission view. Status 401 still redirects to login. The 50-page stop is a successful prefix, not an auth failure disguised as an empty list.

`ed6a1e57` made one request. `SagaController` returned `service.unfinished(200)` and the SQL used `LIMIT ?` (`SagaController.java` 86-90, `JdbcSagaStore.java` 125-138). A stable set of 5,000 or fewer is more complete on the new screen than on the old one. The regression against the new envelope is that `hasMore` is discarded. At 5,100 rows the screen shows the oldest 5,000 and hides the newest unfinished sagas, with no error.

Rework: if the last fetched page still has `hasMore` and `nextCursor`, fail `load()` and keep the error state. Use the same budget rule in the mistake feed. Do not render the prefix under “待恢复业务流程”.

### G449-3. `updated_at` order duplicates a saga after a status update. Regression.

`saga_instance.updated_at` is `DATETIME(6) … ON UPDATE CURRENT_TIMESTAMP(6)` (`V1__create_workflow_service_schema.sql` 25 at `ed6a1e57`). `updateStatus` updates `status` and does not assign `updated_at`, so MySQL advances the column. The new keyset is:

```text
status NOT IN ('COMPLETED','COMPENSATED','COMPENSATION_FAILED')
AND (updated_at > ? OR (updated_at = ? AND saga_id > ?))
ORDER BY updated_at, saga_id
```

(`JdbcSagaStore.java` 131-147). Parameter order matches that predicate. The in-memory slice uses the same comparison (`UnfinishedSagaPaging.java` 102-126). The class comment says the list is oldest-first and unique (12-15). The Cursor parameter says the cursor is stable (`openapi.json` 40108). Each response keeps `hasMore` aligned with `nextCursor` (`openapi.json` 63285-63287). `snapshotAt` is not set, so the contract does not freeze the cross-page set.

Fixture, page size 1, rows at times 1, 2, and 3. After `saga-a` is returned, its `updated_at` becomes 10. The walk emits `saga-a`, `saga-b`, `saga-c`, `saga-a`. A forward update of a row that has not been returned stays after the cursor, so ordinary `ON UPDATE` duplicates and does not skip. A same-microsecond insert with a smaller `saga_id` than the cursor is skipped; inserts use `UTC_TIMESTAMP(6)`, so that window is narrow.

The Vue list uses `:key="id"` (`AdminRecoveryView.vue` 251), so a repeated id collapses to one row. The duplicate still occupies the walk, and the 50-page budget can end before unseen ids are fetched.

`ed6a1e57` read this list in one statement “so a recovery sweep cannot walk the set twice” (`JdbcSagaStore.java` 126-127). That single statement is gone.

The status predicate matches `SagaStatus.isTerminal()`: `COMPLETED`, `COMPENSATED`, `COMPENSATION_FAILED`. `COMPENSATION_FAILED` stays off the list, as it did before. `saga_instance` has no `tenant_id`. The route still requires the platform tenant and `admin.recovery.read`. There is no per-operator SQL predicate; the store comment that mentions owner filters is ahead of the SQL.

Rework: keyset on `started_at, saga_id`. `started_at` is set at insert and is not `ON UPDATE`. The same fixture with that key emits each of the three ids once after `updated_at` moves. Keep the terminal-status filter. Encode the cursor from the same microsecond value the predicate binds. Leave the console on the cursor walk. `SagaStore.unfinished(int)` now goes through `clampLimit`, so a caller that passes 200 gets 100. Do not point a sweep back at `unfinished(200)` and expect the old limit.

### G449-4. An old one-shot caller now receives 20 rows. Split-deploy regression.

Public and internal paths share one method each. Gateway rewrites `/api/v1/assessment/mistakes` to `/internal/v1/assessment/mistakes` and `/api/v1/admin/recovery/sagas/unfinished` to `/internal/v1/workflow/sagas/unfinished`. Both success bodies are `{ data, meta }` with cursor fields only in `meta`.

Omitted `pageSize` is 20 (`MistakeListPaging.java` 33-40, `UnfinishedSagaPaging.java` 19-20 and 39-46). Mistake `data.count` is `items.size()` for that page, capped at 100 by the operation schema. `ed6a1e57` mistake `count` was the full owner list, and the saga body was a raw `string[]` of up to 200.

The frozen admin client and the frozen feed send `pageSize=100` and read `meta`. Shipped with their handlers, they avoid the 20-row default and still have G449-1 and G449-2. An old admin bundle that only unwraps `data` shows 20 saga ids. An old feed that ignores `meta` projects the oldest 20 mistakes.

Rework: release each handler with its updated caller. Keep `count` as a page length only for callers that read `meta`. Leave mobile `listMistakeBook` on `/mastery/mistakes`.

## Boundaries that hold

Mistake SQL filters `tenant_id` and `subject_id` before `mistake_id > ?` (`JdbcAssessmentMistakeList.java` 27-37). The tenant is the server constant `platform`. The subject comes from the verified principal. A cursor for subject A does not return A's rows to subject B. In the fixture, subject B using a cursor of id 500 sees only B's 600. The cursor is still only `asm.v1|{id}`. A forged high id returns 200 and skips that caller's smaller ids. That is an optional 400 if the cursor must be owner-bound. It is not a cross-tenant read.

Invalid cursor and invalid page size are 400 after authorization on both handlers (`SagaController.java` 100-125, assessment 566-578). Gateway error mapping applies to gateway failures, not to a proxied upstream status, so this path does not rewrite a pagination 400 into 401. The admin client throws on non-2xx. The mistake feed is the place that turns those statuses into an empty or partial success.

Offline base64url samples for `asm.v1|{id}` and `v1|{instant}|{sagaId}` round-trip and match `^[A-Za-z0-9._:-]{8,512}$`. The JVM encoder was not executed.

## Tests in the candidate that do not cover these cases

`recovery-sagas.test.mjs` walks two pages and stops when `hasMore` is false. `HttpAssessmentMistakeFeedTest` parses one body and does not perform the HTTP loop. `JdbcSagaStorePaginationTest` returns rows the fake already filtered; it does not move `updated_at` between pages.

## Evidence

`reproduce.mjs` checked the 28 manifest hashes, pinned the frozen loop text, and ran the walker and feed control flow with in-memory pages. Results are in `reproduction-results.json`. No Maven, Docker, listener, browser, or network call was used. The learning and workflow services were not started.

## Rework, in order

1. Fail closed in `HttpAssessmentMistakeFeed` and skip projection unless the walk finished. Surface assessment 401/403 on the learner read.
2. Fail `listAllUnfinishedSagaIds` when the page budget ends with `hasMore` still true. Keep the recovery view on the error state.
3. Move the saga keyset from `updated_at` to `started_at, saga_id`.
4. Ship each handler with its updated client so an old one-shot caller does not silently keep a 20-row page.

No completion or acceptance claim.
