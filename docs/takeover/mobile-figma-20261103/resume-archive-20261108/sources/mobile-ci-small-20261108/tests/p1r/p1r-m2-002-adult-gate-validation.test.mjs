import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const CONTROLLER = 'services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java';
const EVIDENCE = 'services/iam-service/src/main/java/com/englishflow/iam/domain/TrustedAgeEvidence.java';

test('the adult gate validates the derived age before the domain type rejects it', () => {
  const controller = read(CONTROLLER);
  const evidence = read(EVIDENCE);

  // The domain type rejects an out-of-range age with an unchecked exception, so the boundary has to
  // validate the derived age first; otherwise the client sees 500 iam.internal.error with
  // retryable: true and is invited to retry an input that can never succeed.
  assert.match(evidence, /age < 0 \|\| age > 150/u,
    'TrustedAgeEvidence must keep its 0..150 range check');

  const methodStart = controller.indexOf('public ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> adultGate(');
  assert.ok(methodStart > 0, 'the adultGate boundary method must exist');
  const methodEnd = controller.indexOf('\n    @GetMapping("/iam/consents")', methodStart);
  const adultGate = controller.slice(methodStart, methodEnd > methodStart ? methodEnd : methodStart + 4000);

  const nullGuard = adultGate.indexOf('if (request.birthYear() == null)');
  const ageComputation = adultGate.indexOf('int age = currentYear - request.birthYear();');
  const rangeGuard = adultGate.indexOf('if (age < 0 || age > 150)', ageComputation);
  const construction = adultGate.indexOf('TrustedAgeEvidence.fromServerAttestation(age');

  assert.ok(nullGuard > 0, 'the boundary must keep the null birth-year guard');
  assert.ok(ageComputation > nullGuard, 'age derivation must follow the null birth-year guard');
  assert.ok(rangeGuard > ageComputation,
    'the derived-age range guard must sit after int age = currentYear - request.birthYear()');
  assert.ok(construction > rangeGuard,
    'the range guard must run before TrustedAgeEvidence is constructed, not after');

  const nullBranch = adultGate.slice(nullGuard, ageComputation);
  assert.match(nullBranch, /IamDecisionCode\.ADULT_AGE_EVIDENCE_INVALID,\s*"iam\.adult_gate\.birth_year_invalid"/u,
    'the null birth-year guard must keep iam.adult_gate.birth_year_invalid');

  const rangeBranch = adultGate.slice(rangeGuard, construction);
  assert.match(rangeBranch, /age < 0 \|\| age > 150/u,
    'the derived-age branch must keep the 0..150 range check');
  assert.match(rangeBranch, /IamDecisionCode\.ADULT_AGE_EVIDENCE_INVALID,\s*"iam\.adult_gate\.birth_year_invalid"/u,
    'the derived-age branch must use iam.adult_gate.birth_year_invalid');

  assert.match(controller, /@PostMapping\("\/auth\/register"\)/u,
    'Phase 1 public adult registration must remain mapped');
  assert.match(controller, /String scope = "\/api\/v1\/auth\/register";/u,
    'Phase 1 public adult registration must remain /api/v1/auth/register');
});

test('the adult gate rejects implausible birth years as a non-retryable client error', () => {
  const controller = read(CONTROLLER);
  // A permanent input error must not carry retryable: true; the decision code is the one the
  // client-facing envelope maps to a 403.
  assert.match(controller, /ADULT_AGE_EVIDENCE_INVALID,\s*"iam\.adult_gate\.birth_year_invalid"/u);
  assert.doesNotMatch(controller, /throw new IllegalArgumentException\([^)]*birth/u);
});
