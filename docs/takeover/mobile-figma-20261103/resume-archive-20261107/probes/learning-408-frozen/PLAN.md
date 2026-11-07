# Learning assessment Kafka consumer — smallest implementation plan

Audit date: 2026-11-07. Source is current `dev` learning-service, assessment-service, and `packages/contracts`. Historical R1 signoff is not evidence. No product source was changed.

B110 published one `assessment.item.assessed.v2` record. B120 and B134 verified the owner HTTP match. B122 verified READ for `cg.learning-from-assessment.v1` on `platform.assessment.v1`. All four reviews leave Learning consumption, offset commit, and mastery write open. `catalog.json` still marks this event `runtimeStatus: NOT_RUNTIME_VERIFIED`.

There is no Kafka listener under `services/learning-service`. The domain write already exists and must be called as-is.

## What already exists

| Piece | Current symbol |
|---|---|
| Domain write | `LearningMasteryService.applyAssessment(LearningPrincipalContext, ApplyAssessmentLearningCommand)` |
| Command | `ApplyAssessmentLearningCommand(AssessmentLearningEvent, IdempotencyKey, LearningRequestMetadata)` and `fingerprint()` |
| Fact | `AssessmentLearningEvent` (no answer text) |
| Evidence apply | `MasteryProjection.apply(MasteryEvidence)` dedupes on `evidenceId` |
| DB transaction | `LearningFactStore.executeIdempotently` → `JdbcLearningFactStore.executeIdempotently` via `TransactionTemplate` (`PROPAGATION_REQUIRED`). Idempotency row, mastery row, and outbox append commit together. Operation name is `mastery.apply`. |
| Owner match | `B10AssessmentAttemptBindingController.matchB10AssessmentAttemptBinding` `POST /internal/v1/assessment/attempts/{attemptId}/binding` |
| Producer wire | `AssessmentOutboxKafkaRelay.record`: topic `platform.assessment.v1`, key = `aggregateId`, value = stored envelope JSON, headers `eventId`, `eventName`, `schemaVersion`, `eventVersion`, `dedupeKey`, `requestId`, `traceId` |
| IAM client | `learning-service` permission `assessment:attempt-binding:read` only (`services/iam-service/src/main/resources/application.yaml`) |
| Control-loop precedent | `ContentInboundEventConsumer.onEvent`: manual ack after the DB effect. Do not copy its DLQ publish. |

B134’s Java client is not in this tree. `services/learning-service` has no binding client and no service-token client. `LearningTestPrincipals.phaseOne` is test-only and its comment forbids fabricating consent or permissions.

`learning_runtime_idempotency_record` is not a consumer receipt. Its key is `(tenant, principal, user, operation, idempotency_key)`. The contract key is `(consumerGroup, eventId)`.

Latest learning migration is `V14__learning_report_share_idempotency.sql`.

## Decisions the contracts already make

Use these. Do not reopen them.

1. **Offset vs DB.** `reliability-policy.json` `consumer.deduplication.offsetCommit = AFTER_EFFECT_AND_RECEIPT_COMMIT` and `effectAndReceiptSameOwnerTransaction = true`. Prohibitions include `DISTRIBUTED_TWO_PHASE_COMMIT` and `KAFKA_AS_RPC_OR_TRANSACTION_COORDINATOR`. Implement `enable.auto.commit=false` and `AckMode.MANUAL`. Call `Acknowledgment.acknowledge()` only after the learning `TransactionTemplate` returns. A crash between commit and ack is a redelivery. Do not use Kafka transactions or `sendOffsetsToTransaction`.

2. **Dedupe.** Primary unique key `(consumerGroup, eventId)` → outcome `DUPLICATE_SKIPPED`, then ack. Secondary key `dedupeKey`. `sameDedupeKeyDifferentEventId = REJECT_AND_AUDIT`. For this event the OpenAPI owner match fixes `dedupeKey` as `attemptId + ":" + itemAssessmentId`. Domain replay of the same `eventId` stays inside `applyAssessment` (`appliedEvidenceIds` plus `mastery.apply` idempotency). A new command key must not be invented per delivery.

3. **Owner and content version.** The payload principal, tenant, pin, and outcome are not authoritative. After schema acceptance, call `matchB10AssessmentAttemptBinding` outside any DB transaction. Request fields are exactly `eventId`, `learnerPrincipalId`, `itemAssessmentId`, `logicalItemId`, `contentVersionId`, `contentEpoch`, `snapshotId`, `snapshotHash`. Workload JWT: `sub=learning-service`, permission `assessment:attempt-binding:read`, direct to assessment `127.0.0.1:18091` (OpenAPI `gateway: NOT_PROJECTED`). HTTP 200 `data` pin must equal the event `contentPin`. `reporting` `CURRENT` and `HISTORICAL` are both a match. The receipt is not rewritten.

4. **Schema rejection.** Reject before HTTP and before SQL when the header/body/key disagree, `eventName` is not `assessment.item.assessed.v2`, schema is not `assessment.event.v2`, version is not 2, `aggregateType` is not `assessment_item`, `aggregateId` is not `payload.itemAssessmentId`, `dedupeKey` is not `attemptId:itemAssessmentId`, `actorId` is not `payload.principalId`, `tenantId` is not `platform`, or the payload fails `B10AssessmentItemAssessedV2` (`additionalProperties: false` and the objective `oneOf`). Code `SCHEMA_INVALID`. No retry. No mastery write. The canonical envelope does not include `rootEventId` or `aggregateVersion`; the live producer does not emit them. Do not reject current B110 envelopes for those two absent fields. For the receipt, set `rootEventId = eventId` (root-event rule `MUST_EQUAL_EVENT_ID`) and store `partitionKey` as the constant `aggregateId`.

5. **Transient vs terminal.** Retryable: `TIMEOUT`, `TEMPORARY_UNAVAILABLE`, `CONFLICT_RETRYABLE` (binding HTTP 503, broker timeout, `TransientDataAccessException`). Terminal: `FORBIDDEN` (401/403), `OWNER_MISMATCH` (404 `ATTEMPT_NOT_OWNED` and scope mismatch from `LearningDecisionCode.OWNER_MISMATCH`), `SCHEMA_INVALID`, `STALE_VERSION` (409 `PIN_MISMATCH` and `LearningDecisionCode.CONTENT_VERSION_MISMATCH`). Any other code, including 409 `PIN_SUBSTITUTED`, `ITEM_IDENTITY_ABSENT`, `EVIDENCE_REUSED`, `FALLBACK_PIN`, `REPORT_PIN_ABSENT`, and `IDEMPOTENCY_CONFLICT`, is `NON_RETRYABLE_FAIL_CLOSED`.

6. **Retry order.** `maxAttempts = 5` including the first try. In-listener exponential backoff with jitter, base 1000 ms, cap 60000 ms. No receipt row and no offset commit on a retry. Stop the attempt on interrupt and leave the record unacked.

7. **Identity.** Group `cg.learning-from-assessment.v1`. Topic `platform.assessment.v1`. Client id `cg.learning-from-assessment.v1`. Bootstrap `127.0.0.1:19092` (`config/local-ports.json` `kafka`). `auto.offset.reset=earliest` so the first committed offset can replay the 7-day retention. Property prefix `learning.events.assessment-consumer`. `enabled` default `false`. `@ConditionalOnProperty(..., havingValue="true")` and listener `autoStartup` default `false`. Reject a configured group id or topic that differs from the two constants. Do not subscribe to `learning.report.ready.v1` or `assessment.placement.completed.v1` logic in this card.

8. **Same-topic other events.** This group is also the subscriber for `assessment.placement.completed.v1` on the same topic. A non-item record is not `SCHEMA_INVALID`. Do not apply mastery, do not ack, and stop the listener. Acking it would drop a placement fact. Leaving it unacked is why the flag stays off until a placement branch or a fixture that contains only item records is chosen.

## Missing policy (do not invent these)

Three gaps are not decided by the contracts or by `AssessmentLearningEvent`. The consumer shell can be built and unit-tested with fakes. Do not register a production mapper, a fabricated principal, or a DLQ publisher. Do not set `enabled=true`.

1. **Domain field derivation.** `applyAssessment` needs `LearningItemType`, `long itemId >= 1`, `int score` 0–100, and `VerificationStage` `{D0, D1, D7}`. The canonical payload has `logicalItemId` (`li_…`), `itemAssessmentId`, `objectiveCorrect`, and `verificationStage` `{NONE, IMMEDIATE_REPAIR, D1, D7}`. It has no numeric item id, no item type, and no 0–100 score. Binding `data` returns the four pin fields and `reporting` only. `B10AssessmentJdbcController.numericItemId` is a private producer alias and is not a learning contract. The live grammar emitter writes `verificationStage = NONE`. `D1` and `D7` match the domain enum by name. `NONE` and `IMMEDIATE_REPAIR` do not. `LearningMasteryService` does not score answers. A boolean-to-score map is a new rule.

2. **Server principal.** `LearningAccessPolicy.authorize` requires `phase-1`, role `learner`, permission `learning.mastery.write`, `ConsentState.GRANTED`, and `principal.scope()` equal to the event scope. `LearningTestPrincipals` forbids fabricating that context. IAM’s `learning-service` client cannot read consent (`iam.consent.read` belongs to `learner-service`). `LearningTenantScope.forPhaseOne` and `stableUserIdFor` may supply tenant `platform` and the numeric `userId` once a real principal source exists. They do not supply consent.

3. **Terminal destination.** `deadLetter.owner` is `workflow-service`. `platform.events.dlq.v1` WRITE is only `svc.workflow-service` (`config/b26-event-runtime.json`). B122 did not grant this consumer that WRITE. Receipt `outcome` allows only `APPLIED` and `DUPLICATE_SKIPPED`. A terminal item record therefore stays unacked, with no mastery row and no DLQ publish. Enabling the listener will stall that partition on the first terminal record until a workflow writer is authorized.

`aggregateVersion` is the ordering sequence in `reliability-policy.json` `ordering.sequenceField`, and the producer does not send it. Each live item event uses a new `itemAssessmentId`, so there is no second version to hold. Do not add a reorder buffer in this card. A second event id on the same `dedupeKey` is already the reject path in decision 2.

## Bounded sequence

Stay inside learning-service plus one changelog line. Do not edit assessment producer, IAM, ACL, OpenAPI, AsyncAPI, gateway routes, `LearningMasteryService`, `AssessmentLearningEvent`, or `LearningFactStore`.

1. **Receipt migration** `V15__learning_assessment_consumer_receipt.sql` in the learning schema. Columns for `platform.event.consumer-effect-receipt.v1` that this consumer can fill: `receipt_id`, `consumer_group`, `consumer_service` (`learning-service`), `event_id`, `root_event_id`, `event_name`, `aggregate_type`, `aggregate_id`, `schema_version`, `dedupe_key`, `request_id`, `trace_id`, `topic`, `partition_key` (constant `aggregateId`), `payload_digest` (sha256 of the record value), `effect_type` (`mastery.apply`), `effect_id`, `effect_digest`, `attempt`, `outcome`, `processed_at`. Primary key `(consumer_group, event_id)`. Unique key `(consumer_group, dedupe_key)`. No raw payload, answer, token, or score. Leave `LearningSchema.ownedFacts()` unchanged.

2. **Properties and configuration**, default off. Mirror `LearningEventRelayConfiguration` / `ContentInboundConsumerConfiguration` only for the consumer factory: `ENABLE_AUTO_COMMIT_CONFIG=false`, manual ack, `String` deserializers, client id and group id fixed, bootstrap `127.0.0.1:19092`. No `DeadLetterPublishingRecoverer`.

3. **Schema gate** pure function over `ConsumerRecord`. Implements decision 4. Returns a closed failure code or a parsed envelope. Parses the body with the existing Jackson `ObjectMapper`. Does not call domain code.

4. **Binding client** `POST` the closed body to `http://127.0.0.1:18091/internal/v1/assessment/attempts/{attemptId}/binding`. Bearer comes from an injected `Supplier<String>` (IAM-issued `learning-service` token). Map status codes per decision 5. Compare returned pin fields to `contentPin`. This call stays outside the DB transaction.

5. **Apply transaction.** One `TransactionTemplate` on the learning `PlatformTransactionManager`:
   - Insert the receipt.
   - Duplicate `(consumer_group, event_id)` → roll back to no new write, return `DUPLICATE_SKIPPED`.
   - Duplicate `(consumer_group, dedupe_key)` with a different `event_id` → roll back, return terminal reject.
   - On a new receipt, call `LearningMasteryService.applyAssessment` with an `IdempotencyKey` equal to the event id (UUID matches the 16–128 safe pattern) and `LearningRequestMetadata` from the envelope `requestId` / `traceId`.
   - `JdbcLearningFactStore.executeIdempotently` joins this transaction (`REQUIRED`), so the receipt, `learning_runtime_idempotency_record`, mastery, and outbox commit once.
   - Ack only after that commit.
   - Production wiring does not supply a principal or a mapper until the three missing decisions are recorded. The method that would build `AssessmentLearningEvent` stays package-visible and unregistered. Unit tests pass a fake principal and a fake mapper.

6. **Retry loop** in the listener, copied in structure from `ContentInboundEventConsumer.onEvent` (attempt counter, backoff, ack after success, no ack after interrupt). Terminal path logs the contract failure code, writes nothing, and does not ack.

7. **Tests** (below). No Testcontainers, no broker, no MySQL, no IAM.

8. **Changelog** one line: learning assessment consumer added, default disabled, not runtime-verified. Do not edit `docs/STATUS.md` or the B110/B120/B122/B134 reviews.

## Tests

`services/learning-service/src/test/java/com/englishflow/learning/integration/AssessmentItemAssessedConsumerTest.java`

- Schema failure does not call binding, does not call `applyAssessment`, does not ack, and does not sleep.
- Binding 503 retries up to 5 and does not ack or write.
- Binding 404 and 409 `PIN_MISMATCH` are terminal: no retry, no ack, no `applyAssessment`.
- Happy path with a fake principal and fake mapper: `applyAssessment` once, receipt insert in the same `TransactionTemplate` callback, ack once after the callback returns.
- Second delivery of the same `eventId`: no second `applyAssessment`, ack once.
- Same `dedupeKey`, different `eventId`: rollback, no `applyAssessment`, no ack.
- `eventName` `assessment.placement.completed.v1`: no `applyAssessment`, no ack.
- Configuration test: beans absent when `learning.events.assessment-consumer.enabled` is unset; group id and topic constants match the contract.

Do not add a test that enables the listener against `19092`.

## Verification the later card may claim

Unit tests above. The flag remains false. B110/B120/B122/B134 remain the producer, binding, and ACL evidence. This card does not add consumer runtime evidence.

## Out of scope

Gamification and workflow subscribers, placement consumption, SRS scheduling, mistake projection, review queue, ACL edits, producer envelope changes, gateway projection, and turning the flag on.
