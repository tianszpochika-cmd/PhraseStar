import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const contentOpenApi = readJson('packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json');
const compatibilityOpenApi = readJson('packages/contracts/fragments/b10/b10-compatibility.openapi.json');
const openApi = {
  paths: { ...(contentOpenApi.paths ?? {}), ...(compatibilityOpenApi.paths ?? {}) },
  components: {
    parameters: { ...(contentOpenApi.components?.parameters ?? {}), ...(compatibilityOpenApi.components?.parameters ?? {}) },
    responses: { ...(contentOpenApi.components?.responses ?? {}), ...(compatibilityOpenApi.components?.responses ?? {}) },
    schemas: { ...(contentOpenApi.components?.schemas ?? {}), ...(compatibilityOpenApi.components?.schemas ?? {}) },
  },
};
const events = readJson('packages/contracts/events/v1/fragments/b10-learning-assessment.events.json');
const fixture = readJson('tests/b10/fixtures/b10-learning-assessment.fixture.json');
const migration = readText('database/mysql/migrations/V0018__create_learning_assessment_event_reliability_b10.sql');
const manifest = readJson('database/mysql/migrations/migration-manifest.json');

function walk(value, visitor) {
  visitor(value);
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) walk(child, visitor);
}

test('B10 OpenAPI covers snapshot, attempt, projection and compatibility boundaries', () => {
  for (const route of [
    '/internal/v1/content/assessment-snapshots/{contentVersionId}',
    '/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery',
    '/api/v1/assessment/sessions',
    '/api/v1/assessment/sessions/{sessionId}/attempts',
    '/api/v1/learning/review-queue',
    '/internal/v1/compatibility/b10/read-shadow',
    '/internal/v1/compatibility/b10/reconciliations',
    '/internal/v1/compatibility/b10/rollbacks',
  ]) assert.ok(openApi.paths[route], `missing B10 route ${route}`);
  for (const schema of ['B10ContentVersionPin', 'B10ActiveSessionAttemptPin', 'B10AssessmentContentSnapshot', 'B10Attempt', 'B10MasteryProjection', 'B10ReadShadow', 'B10RollbackRequest']) {
    assert.ok(openApi.components.schemas[schema], `missing B10 schema ${schema}`);
  }
  for (const operation of Object.values(openApi.paths).flatMap((item) => Object.values(item))) {
    if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
    if (operation.security?.some((entry) => entry.B8WorkloadIdentity)) assert.ok(operation.security.length > 0);
  }
});

test('B10 keeps active session and attempt pins immutable while future reads alone may fall back', () => {
  const schemas = openApi.components.schemas;
  assert.deepEqual(schemas.B10ContentVersionPin['x-p1r-pin-scope-policy'], {
    usage: 'FUTURE_READ_OR_UNSTARTED_TASK',
    safeFallback: 'ALLOWED_BEFORE_SESSION_OR_ATTEMPT_START_ONLY',
    activeReplacement: 'PROHIBITED',
    recoveredIdentity: 'FULL_IMMUTABLE_FALLBACK',
    permanentRemovalRecovery: 'PROHIBITED',
  });
  assert.equal(schemas.B10ContentVersionPin.readOnly, true);
  assert.equal(schemas.B10ContentVersionPin.oneOf.length, 5);
  assert.deepEqual(schemas.B10ContentVersionPin.oneOf[0].properties.pinStatus.enum, ['PINNED']);
  assert.deepEqual(schemas.B10ContentVersionPin.oneOf[0].properties.recoveryReasonCode.enum, ['NONE']);
  assert.deepEqual(schemas.B10ContentVersionPin.oneOf[3].required, ['recoveryReasonCode', 'fallbackVersionId', 'fallbackContentEpoch', 'fallbackSnapshotId', 'fallbackSnapshotHash']);
  assert.deepEqual(schemas.B10ContentVersionPin.oneOf[4].properties.recoveryReasonCode.enum, ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED']);
  assert.deepEqual(schemas.B10ActiveSessionAttemptPin['x-p1r-active-pin-policy'].allowedOutcomes, ['AVAILABLE', 'UNAVAILABLE']);
  assert.deepEqual(schemas.B10ActiveSessionAttemptPin.properties.status.enum, ['AVAILABLE', 'UNAVAILABLE']);
  assert.deepEqual(schemas.B10ActiveSessionAttemptPin.oneOf[1].required, ['status', 'reasonCode', 'alternativeAction']);
  for (const name of ['B10AssessmentSession', 'B10Attempt', 'B10AssessmentReport', 'B10MasteryProjection']) {
    assert.equal(schemas[name].properties.pin.$ref, '#/components/schemas/B10ActiveSessionAttemptPin');
  }
  for (const name of ['B10LearnerContentSnapshot', 'B10AssessmentContentSnapshot', 'B10LearningQueueItem']) {
    assert.equal(schemas[name].properties.pin.$ref, '#/components/schemas/B10ContentVersionPin');
  }
  const recovery = schemas.B10ContentRecovery;
  assert.ok(recovery.required.includes('usageScope'));
  assert.deepEqual(recovery.properties.mustNotRegrade.enum, [true]);
  assert.deepEqual(recovery.properties.usageScope.enum, ['FUTURE_READ_ONLY']);
  assert.deepEqual(recovery.properties.recoveryReasonCode.enum.slice(-3), ['RIGHTS_REMOVED', 'SECURITY_REMOVED', 'LEGAL_REMOVED']);
  assert.deepEqual(recovery.oneOf[0].properties.resolution.enum, ['EXACT_PIN']);
  assert.deepEqual(recovery.oneOf[2].properties.resolution.enum, ['SAFE_FUTURE_FALLBACK']);
  assert.deepEqual(recovery.oneOf[2].required, ['resolvedVersionId', 'resolvedSnapshotId']);
  assert.equal(contentOpenApi.paths['/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery'].get['x-contract'].activeSessionOrAttempt, 'PROHIBITED');
  const unsupported = [];
  walk(contentOpenApi, (value) => {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'const')) unsupported.push(value.const);
  });
  assert.deepEqual(unsupported, []);
});

test('B10 events have the canonical envelope and no answer-bearing payload fields', () => {
  const names = new Set();
  const forbidden = new Set(['answerKey', 'correctAnswer', 'acceptedAnswers', 'rawAnswer', 'answerText', 'answerContent', 'referenceAnswer', 'userInput', 'prompt', 'rawRecording', 'audioBytes']);
  for (const event of events.events) {
    assert.equal(names.has(event.eventName), false, `duplicate event ${event.eventName}`);
    names.add(event.eventName);
    for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey']) assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} missing ${field}`);
    const payload = events.payloadSchemas[event.payloadSchema.$ref.split('/').at(-1)];
    walk(payload, (value) => {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value.properties ?? {})) assert.equal(forbidden.has(key), false, `${event.eventName} leaks ${key}`);
    });
  }
  // A frozen list turns every legitimate contract addition into a failure while saying nothing about
  // whether the addition is allowed. The real invariants are that the B10 chain is still covered and
  // that nothing enters this fragment without being registered in the catalog first.
  for (const required of [
    'assessment.attempt.submitted.v1',
    'assessment.attempt.assessed.v1',
    'learning.mastery.projected.v1',
    'learning.review.scheduled.v1',
    'workflow.assessment_learning.saga_started.v1',
    'workflow.assessment_learning.saga_compensated.v1',
    'workflow.event.replayed.v1',
  ]) assert.ok(names.has(required), `B10 fragment lost ${required}`);
  const catalog = readJson('packages/contracts/events/v1/catalog.json');
  const registered = new Set(catalog.events.map((event) => event.eventName));
  for (const name of names) assert.ok(registered.has(name), `${name} is in the B10 fragment but not registered in the catalog`);
});

test('B10 fixture proves dedupe, DLQ replay, Saga compensation and legacy rollback', () => {
  assert.equal(fixture.metadata.synthetic, true);
  assert.equal(fixture.contentSnapshot.mustNotExpose.includes('answerKey'), true);
  assert.equal(fixture.attemptToLearningChain.attemptSubmitted.payload.contentVersionId, 301);
  assert.equal(fixture.attemptToLearningChain.attemptAssessed.payload.contentSnapshotId, 'snap_b10_00000001');
  assert.equal(fixture.attemptToLearningChain.masteryProjected.payload.sourceAssessmentEventId, 'evt-b10-assessed-0001');
  assert.equal(fixture.reliability.dlqReplay.mustPreserveTraceId, true);
  assert.equal(fixture.reliability.dlqReplay.mustCreateNewReplayEventId, true);
  assert.equal(fixture.reliability.saga.compensationAction, 'MARK_PROJECTION_RETRY');
  assert.equal(fixture.compatibility.targetFactsRemainUntouched, true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `wf_b10_dlq_event`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `wf_b10_saga`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `cmp_b10_rollback_ledger`/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)/i);
  const entry = manifest.migrations.find((item) => item.version === '0018');
  assert.ok(entry, 'migration manifest must include V0018');
  for (const table of entry.requiredTables) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '`'));
});

const BINDING_PATH = '/internal/v1/assessment/attempts/{attemptId}/binding';
const PREEXISTING_B10_PATHS = [
  '/api/v1/learning/content-snapshots/{contentVersionId}',
  '/internal/v1/content/assessment-snapshots/{contentVersionId}',
  '/internal/v1/content/assessment-snapshots/{contentVersionId}/score',
  '/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery',
  '/internal/v1/learning/plans/current-view',
  '/internal/v1/content/placement-bank/plan-items',
  '/internal/v1/content/placement-bank/sealed',
  '/api/v1/assessment/sessions',
  '/api/v1/assessment/sessions/{sessionId}',
  '/api/v1/assessment/sessions/{sessionId}/attempts',
  '/api/v1/assessment/sessions/{sessionId}/checkpoint',
  '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint',
  '/api/v1/assessment/reports/{reportId}',
  '/api/v1/learning/review-queue',
  '/api/v1/learning/review-queue/{queueItemId}/complete',
  '/api/v1/learning/mastery/{itemId}',
  '/api/v1/learning/plans/current',
  '/api/v1/learning/today',
  '/api/v1/learning/plans/reorder',
  '/api/v1/learning/plans:ensure',
  '/api/v1/learning/plans:replan',
  '/api/v1/learning/tasks/{taskId}/complete',
  '/api/v1/learning/repairs',
  '/api/v1/learning/repairs/{repairId}',
  '/api/v1/learning/mastery',
  '/api/v1/learning/reports/{reportType}',
  '/api/v1/assessment/mistakes',
  '/api/v1/assessment/mistakes/{mistakeId}/verify',
  '/api/v1/assessment/mistakes/{mistakeId}/variant',
];
const BINDING_REQUEST_FIELDS = [
  'eventId',
  'learnerPrincipalId',
  'itemAssessmentId',
  'logicalItemId',
  'contentVersionId',
  'contentEpoch',
  'snapshotId',
  'snapshotHash',
];
const BINDING_RESPONSE_FIELDS = [
  'attemptId',
  'itemAssessmentId',
  'logicalItemId',
  'learnerPrincipalId',
  'tenantId',
  'contentVersionId',
  'contentEpoch',
  'snapshotId',
  'snapshotHash',
  'pinnedAt',
  'pinSource',
  'reporting',
  'owner',
];
const BINDING_CONFLICT_CODES = [
  'PIN_SUBSTITUTED',
  'ITEM_IDENTITY_ABSENT',
  'EVIDENCE_REUSED',
  'PIN_MISMATCH',
  'FALLBACK_PIN',
  'REPORT_PIN_ABSENT',
];
const BINDING_FORBIDDEN_FIELDS = [
  'answer',
  'answers',
  'outcome',
  'objectiveOutcome',
  'score',
  'scoreBucket',
  'quality',
  'rawQuality',
  'guessSignal',
  'tenant',
  'contentCode',
  'progress',
  'mastery',
  'masterySignal',
  'mistake',
  'mistakeCodes',
  'repair',
  'selectedOptionId',
  'rawResponse',
  'answerKey',
  'snapshotItemId',
  'items',
  'pin',
];

function assertClosedBindingFailure(response, codes, message) {
  assert.equal(Object.hasOwn(response, 'headers'), false);
  assert.deepEqual(Object.keys(response.content), ['application/json']);
  const schema = response.content['application/json'].schema;
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ['code']);
  assert.deepEqual(Object.keys(schema.properties), ['code', 'message']);
  assert.equal(schema.properties.code.type, 'string');
  assert.deepEqual(schema.properties.code.enum, codes);
  assert.equal(Object.hasOwn(schema.properties.code, 'const'), false);
  assert.equal(schema.properties.message.type, 'string');
  assert.equal(schema.properties.message.minLength, 1);
  assert.equal(schema.properties.message.maxLength, 80);
  assert.deepEqual(schema.properties.message.enum, [message]);
  assert.equal(message.length >= 1 && message.length <= 80, true);
  for (const name of [
    'details', 'detail', 'reason', 'error', 'path', 'exception', 'timestamp', 'status',
    'traceId', 'requestId', 'retryable', 'learnerPrincipalId', 'permission', 'service_id', 'token',
  ]) assert.equal(Object.hasOwn(schema.properties, name), false, name);
}

test('B10 learning owner binding is an internal workload read', () => {
  const placementOpenApi = readJson('packages/contracts/fragments/b10/b10-placement.openapi.json');
  const schemas = contentOpenApi.components.schemas;
  for (const route of PREEXISTING_B10_PATHS) assert.ok(contentOpenApi.paths[route], `old B10 route changed or removed: ${route}`);
  const addedPaths = Object.keys(contentOpenApi.paths).filter((route) => !PREEXISTING_B10_PATHS.includes(route));
  assert.deepEqual(addedPaths, [BINDING_PATH]);
  for (const document of [contentOpenApi, compatibilityOpenApi, placementOpenApi]) {
    for (const route of Object.keys(document.paths ?? {})) {
      if (!route.includes('binding')) continue;
      assert.equal(route, BINDING_PATH);
      assert.equal(route.startsWith('/internal/v1/'), true, 'binding must not gain a public route');
    }
  }
  assert.equal(contentOpenApi.paths['/api/v1/assessment/attempts/{attemptId}/binding'], undefined);

  const scorePath = contentOpenApi.paths['/internal/v1/content/assessment-snapshots/{contentVersionId}/score'];
  assert.deepEqual(Object.keys(scorePath), ['post']);
  const score = scorePath.post;
  assert.equal(score.operationId, 'scoreB10AssessmentContentSnapshot');
  assert.deepEqual(score.security, [{ B8WorkloadIdentity: [] }]);
  assert.equal(score['x-authorization'].workloadClientId, 'assessment-service');
  assert.equal(score['x-authorization'].requiredPermission, 'content:answer-rules:read');
  assert.equal(score['x-contract'].task, 'MB-014');
  assert.equal(score['x-idempotency'].required, false);
  assert.deepEqual(Object.keys(score.responses), ['200', '400', '401', '403', '404', '409', '410']);
  assert.equal(score.requestBody.content['application/json'].schema.$ref, '#/components/schemas/B10AssessmentContentScoreRequest');
  assert.equal(score.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/B10AssessmentContentScore');
  assert.deepEqual(schemas.B10AssessmentContentScoreRequest.required, ['contentCode', 'itemId', 'selectedOptionId', 'snapshotId', 'snapshotHash', 'ruleDigest']);
  assert.deepEqual(schemas.B10AssessmentContentScore.required, ['itemId', 'snapshotId', 'ruleDigest', 'outcome']);

  const attemptPath = contentOpenApi.paths['/api/v1/assessment/sessions/{sessionId}/attempts'];
  assert.deepEqual(Object.keys(attemptPath), ['post']);
  assert.equal(attemptPath.post.operationId, 'submitB10AssessmentAttempt');
  assert.deepEqual(attemptPath.post.security, [{ bearerAuth: [] }]);
  assert.equal(attemptPath.post['x-contract'].write, true);
  assert.equal(attemptPath.post['x-idempotency'].required, true);
  assert.ok(attemptPath.post.responses['202']);

  const reviewPath = contentOpenApi.paths['/api/v1/learning/review-queue/{queueItemId}/complete'];
  assert.deepEqual(Object.keys(reviewPath), ['post']);
  assert.equal(reviewPath.post.operationId, 'completeB10LearningReview');
  assert.equal(reviewPath.post['x-contract'].owner, 'learning-service');
  assert.equal(reviewPath.post['x-authorization'].requiredPermission, 'learning.srs.write');
  assert.match(reviewPath.post['x-contract'].runtimeEvidenceGate, /UNTRUSTED_REVIEW_EVIDENCE/);

  const bindingPath = contentOpenApi.paths[BINDING_PATH];
  assert.deepEqual(Object.keys(bindingPath), ['post']);
  const operation = bindingPath.post;
  assert.equal(operation.operationId, 'matchB10AssessmentAttemptBinding');
  assert.deepEqual(operation.security, [{ B8WorkloadIdentity: [] }]);
  assert.equal(operation.security.some((entry) => Object.hasOwn(entry, 'bearerAuth')), false);
  assert.deepEqual(operation.parameters, [{ $ref: '#/components/parameters/B10AttemptId' }]);
  assert.equal(JSON.stringify(operation.parameters).includes('Idempotency-Key'), false);
  assert.equal(operation['x-idempotency'].keyHeader, undefined);
  assert.equal(operation['x-contract'].write, false);
  assert.equal(operation['x-contract'].readOnly, true);
  assert.equal(operation['x-contract'].publicRoute, false);
  assert.equal(operation['x-contract'].gateway, 'NOT_PROJECTED');
  assert.equal(operation['x-contract'].learnerClaim, 'NOT_AUTHORITATIVE');
  assert.equal(operation['x-contract'].failureEcho, 'PROHIBITED');
  assert.equal(operation['x-contract'].ownerMatch.fallback, 'PROHIBITED');
  assert.equal(operation['x-contract'].ownerMatch.historyRewrite, 'PROHIBITED');
  assert.equal(operation['x-contract'].ownerMatch.pinColumns.snapshotId, 'b10_assessment_session.owner_snapshot_ref');
  assert.equal(operation['x-contract'].ownerMatch.pinColumns.contentVersionId, 'b10_assessment_session.content_version_id');
  assert.equal(operation['x-contract'].ownerMatch.pinColumns.contentEpoch, 'b10_assessment_session.content_epoch');
  assert.equal(operation['x-contract'].ownerMatch.pinColumns.snapshotHash, 'b10_assessment_session.snapshot_hash');
  assert.match(operation['x-contract'].ownerMatch.pinnedAt, /started_at/);
  assert.equal(operation['x-contract'].ownerMatch.reporting.HISTORICAL.includes('not rewritten'), true);
  assert.equal(operation['x-idempotency'].required, false);
  assert.equal(operation['x-idempotency'].reservation, 'NONE');

  const authorization = operation['x-authorization'];
  assert.equal(authorization.defaultDecision, 'DENY');
  assert.equal(authorization.requiredPermission, 'assessment:attempt-binding:read');
  assert.equal(authorization.permissionStatus, 'PROPOSED');
  assert.equal(authorization.credentialRegistration, 'NOT_REGISTERED');
  assert.equal(authorization.workloadClientId, 'learning-service');
  assert.equal(authorization.tokenType, 'service');
  assert.equal(authorization.algorithm, 'RS256');
  assert.equal(authorization.typ, 'JWT');
  assert.equal(authorization.issuer, '${IAM_JWT_ISSUER:http://127.0.0.1:18087}');
  assert.equal(authorization.audience, '${IAM_JWT_AUDIENCE:yuxuexing-api}');
  assert.equal(authorization.tenantId, 'platform');
  assert.deepEqual(authorization.roles, []);
  assert.deepEqual(authorization.trustedFacts, ['service_id', 'token_type', 'permission', 'tenant_id']);
  assert.equal(authorization.serviceIdBinding.includes('learning-service'), true);

  const ownership = operation['x-ownership'];
  assert.equal(ownership.mode, 'CONTRACT_ONLY');
  assert.equal(ownership.gatewayProjection, 'PROHIBITED');
  assert.equal(ownership.publicRoute, false);
  assert.equal(ownership.learningGroupOffset, 'UNCHANGED');
  assert.equal(ownership.learningGroup, 'cg.learning-from-assessment.v1');
  assert.equal(ownership.currentReview, 'UNCHANGED');
  assert.equal(ownership.currentReviewOperation, 'completeB10LearningReview');
  assert.equal(ownership.credential.status, 'PROPOSED');
  assert.equal(ownership.credential.registeredInIam, false);
  assert.equal(ownership.credential.permission, 'assessment:attempt-binding:read');
  assert.deepEqual(ownership.credential.existingServiceClients, ['api-gateway', 'assessment-service', 'learner-service']);
  assert.equal(ownership.retentionGate.status, 'UNRESOLVED');

  assert.deepEqual(operation.responses['400'], { $ref: '#/components/responses/B10BadRequest' });
  assert.deepEqual(operation.responses['401'], { $ref: '#/components/responses/B10Unauthorized' });
  assert.deepEqual(operation.responses['403'], { $ref: '#/components/responses/B10Forbidden' });
  assert.deepEqual(operation.responses['404'], { $ref: '#/components/responses/B10AttemptBindingNotOwned' });
  assert.deepEqual(operation.responses['409'], { $ref: '#/components/responses/B10AttemptBindingConflict' });
  assert.deepEqual(operation.responses['503'], { $ref: '#/components/responses/ApiServiceUnavailable' });
  assert.equal(operation['x-contract'].failClosed.wrongSubjectOrMissingAttempt, '404 #/components/responses/B10AttemptBindingNotOwned code ATTEMPT_NOT_OWNED indistinguishable');
  assert.deepEqual(operation['x-contract'].errorComponents, {
    400: '#/components/responses/B10BadRequest',
    401: '#/components/responses/B10Unauthorized',
    403: '#/components/responses/B10Forbidden',
    404: '#/components/responses/B10AttemptBindingNotOwned',
    409: '#/components/responses/B10AttemptBindingConflict',
    503: '#/components/responses/ApiServiceUnavailable',
  });
  for (const [reason, code] of [
    ['substitute', 'PIN_SUBSTITUTED'],
    ['missingExactItem', 'ITEM_IDENTITY_ABSENT'],
    ['reusedEvidence', 'EVIDENCE_REUSED'],
    ['mismatch', 'PIN_MISMATCH'],
    ['fallbackPin', 'FALLBACK_PIN'],
    ['missingOrInvalidReport', 'REPORT_PIN_ABSENT'],
  ]) {
    assert.equal(operation['x-contract'].failClosed[reason], `409 #/components/responses/B10AttemptBindingConflict code ${code}`);
  }
  assert.equal(operation['x-contract'].failClosed.ownerUnavailable, '503 #/components/responses/ApiServiceUnavailable');
  assert.equal(score['x-contract'].errorComponents['404'], '#/components/responses/B10NotFound');
  assert.equal(score['x-contract'].errorComponents['409'], '#/components/responses/B10Conflict');
  assert.deepEqual(score.responses['404'], { $ref: '#/components/responses/B10NotFound' });
  assert.deepEqual(score.responses['409'], { $ref: '#/components/responses/B10Conflict' });
  assert.deepEqual(contentOpenApi.components.responses.B10NotFound, { description: 'Resource not found' });
  assert.deepEqual(contentOpenApi.components.responses.B10Conflict, { description: 'Idempotency, state version or content pin conflict' });
  assert.deepEqual(contentOpenApi.components.responses.B10BadRequest, { description: 'Invalid request or state transition' });
  assert.deepEqual(contentOpenApi.components.responses.B10Unauthorized, { description: 'Missing or invalid subject' });
  assert.deepEqual(contentOpenApi.components.responses.B10Forbidden, { description: 'Resource owner, policy or content rights denied' });
  const notOwned = contentOpenApi.components.responses.B10AttemptBindingNotOwned;
  const conflict = contentOpenApi.components.responses.B10AttemptBindingConflict;
  assertClosedBindingFailure(notOwned, ['ATTEMPT_NOT_OWNED'], 'attempt is not available');
  assertClosedBindingFailure(conflict, BINDING_CONFLICT_CODES, 'owner match was rejected');
  const bindingSource = readText('packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json');
  const bindingStart = bindingSource.indexOf('"/internal/v1/assessment/attempts/{attemptId}/binding"');
  const bindingEnd = bindingSource.indexOf('"/api/v1/assessment/sessions"', bindingStart);
  const bindingOperationSource = bindingSource.slice(bindingStart, bindingEnd);
  assert.equal(bindingStart > 0 && bindingEnd > bindingStart, true);
  assert.match(bindingOperationSource, /#\/components\/responses\/B10AttemptBindingNotOwned/);
  assert.match(bindingOperationSource, /#\/components\/responses\/B10AttemptBindingConflict/);
  assert.equal(bindingOperationSource.includes('#/components/responses/B10NotFound'), false);
  assert.equal(bindingOperationSource.includes('#/components/responses/B10Conflict"'), false);
  assert.equal(bindingOperationSource.includes('"const"'), false);
  const failureSource = bindingSource.slice(
    bindingSource.indexOf('"B10AttemptBindingNotOwned"'),
    bindingSource.indexOf('\n    "schemas"'),
  );
  assert.match(failureSource, /"enum": \[\s*"ATTEMPT_NOT_OWNED"\s*\]/);
  assert.match(failureSource, /"enum": \[\s*"PIN_SUBSTITUTED",\s*"ITEM_IDENTITY_ABSENT",\s*"EVIDENCE_REUSED",\s*"PIN_MISMATCH",\s*"FALLBACK_PIN",\s*"REPORT_PIN_ABSENT"\s*\]/);
  assert.equal(failureSource.includes('"const"'), false);
  assert.equal(failureSource.includes('"details"'), false);
  assert.equal(failureSource.includes('learnerPrincipalId'), false);
  assert.equal(failureSource.includes('assessment:attempt-binding:read'), false);
  assert.equal(operation.responses['500'], undefined);
  assert.equal(
    contentOpenApi.paths['/internal/v1/learning/plans/current-view'].get.responses['503'].$ref,
    '#/components/responses/ApiServiceUnavailable',
  );
  assert.equal(operation.requestBody.content['application/json'].schema.$ref, '#/components/schemas/B10AttemptBindingMatch');
  assert.equal(operation.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/B10AttemptBindingResponse');

  const requestSchema = schemas.B10AttemptBindingMatch;
  const resultSchema = schemas.B10AttemptBinding;
  const responseSchema = schemas.B10AttemptBindingResponse;
  assert.equal(requestSchema.additionalProperties, false);
  assert.equal(resultSchema.additionalProperties, false);
  assert.equal(responseSchema.additionalProperties, false);
  assert.deepEqual(requestSchema.required, BINDING_REQUEST_FIELDS);
  assert.deepEqual(Object.keys(requestSchema.properties), BINDING_REQUEST_FIELDS);
  assert.deepEqual(resultSchema.required, BINDING_RESPONSE_FIELDS);
  assert.deepEqual(Object.keys(resultSchema.properties), BINDING_RESPONSE_FIELDS);
  assert.deepEqual(Object.keys(responseSchema.properties), ['data']);
  assert.equal(responseSchema.properties.data.$ref, '#/components/schemas/B10AttemptBinding');
  assert.deepEqual(resultSchema.properties.tenantId.enum, ['platform']);
  assert.deepEqual(resultSchema.properties.pinSource.enum, ['b10_assessment_session.started_at']);
  assert.deepEqual(resultSchema.properties.reporting.enum, ['CURRENT', 'HISTORICAL']);
  assert.deepEqual(resultSchema.properties.owner.enum, ['assessment-service']);
  assert.equal(requestSchema.properties.eventId.format, 'uuid');
  assert.equal(requestSchema.properties.eventId.minLength, 36);
  assert.equal(requestSchema.properties.eventId.maxLength, 36);
  for (const name of BINDING_FORBIDDEN_FIELDS) {
    assert.equal(Object.hasOwn(requestSchema.properties, name), false, `request exposes ${name}`);
    assert.equal(Object.hasOwn(resultSchema.properties, name), false, `response exposes ${name}`);
    assert.equal(Object.hasOwn(responseSchema.properties, name), false, `response envelope exposes ${name}`);
  }

  const iam = readText('services/iam-service/src/main/resources/application.yaml');
  assert.match(iam, /service-clients:/);
  assert.doesNotMatch(iam, /learning-service:/);
  assert.doesNotMatch(iam, /assessment:attempt-binding:read/);
  const gateway = readText('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java');
  assert.doesNotMatch(gateway, /attempts\/\{attemptId\}\/binding/);
  const routing = readText('config/b26-event-runtime.json');
  assert.match(routing, /cg\.learning-from-assessment\.v1/);
  assert.match(routing, /assessment\.item\.assessed\.v2/);
});
