import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const out = [];
const say = (title, value) => {
  out.push(`\n## ${title}\n`);
  out.push(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
};

function gitShow(ref, relativePath) {
  return execFileSync('git', ['show', `${ref}:${relativePath}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const {
  stableGovernanceSha256,
  M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M2001_SOURCE_CONTRACT_BASELINE_REF,
  M2001_APPROVED_ADDITIVE_NODES,
  M2001_APPROVED_REPLACED_NODES,
  isValidM2001PromotionAllowance,
  buildM2001OpenApiExpectedProjection,
  M1018_SOURCE_CONTRACT_BASELINE_REF,
  M1018_EVENT_SOURCE_SEMANTIC_SHA256,
  M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1018_EVENT_DESCRIPTOR_SET_SHA256,
  compareContracts,
  compareM1018EventDescriptors,
} = await import(`${root}/scripts/contracts/compatibility-diff.mjs`);
const { validateM1018CompatibilityPolicy, REQUIRED_CI_CONTRACT_BASELINE_REF, runGitBaselineCompatibility } = await import(`${root}/scripts/contracts/compatibility-git-baseline.mjs`);
const { validateApiContractData } = await import(`${root}/scripts/audit/p1r-api-contract-check.mjs`);
const { validateContentLifecycle, readContentLifecycleInputs } = await import(`${root}/scripts/audit/p1r-content-lifecycle-check.mjs`);
const { validateLearningLoopContract } = await import(`${root}/scripts/audit/p1r-learning-loop-contract-check.mjs`);
const { validateGatewayContract } = await import(`${root}/scripts/audit/p1r-gateway-contract-check.mjs`);
const { validateDataOwnership } = await import(`${root}/scripts/audit/p1r-data-ownership-check.mjs`);

function operationKeys(document) {
  const publicOps = [];
  const internalOps = [];
  for (const [route, item] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(item ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const id = item[method]?.operationId ?? '?';
      const row = `${method.toUpperCase()} ${route} ${id}`;
      if (route.startsWith('/api/v1/')) publicOps.push(row);
      else if (route.startsWith('/internal/v1/')) internalOps.push(row);
    }
  }
  return { publicOps: publicOps.sort(), internalOps: internalOps.sort() };
}

function diffLists(older, newer) {
  const oldSet = new Set(older);
  const newSet = new Set(newer);
  return {
    added: newer.filter((item) => !oldSet.has(item)),
    removed: older.filter((item) => !newSet.has(item)),
  };
}

const currentOpenApi = readJson('packages/contracts/openapi/v1/openapi.json');
const ciOpenApi = JSON.parse(gitShow(REQUIRED_CI_CONTRACT_BASELINE_REF, 'packages/contracts/openapi/v1/openapi.json'));
const m2001OpenApi = JSON.parse(gitShow(M2001_SOURCE_CONTRACT_BASELINE_REF, 'packages/contracts/openapi/v1/openapi.json'));
const currentOps = operationKeys(currentOpenApi);
const ciOps = operationKeys(ciOpenApi);
const m2001Ops = operationKeys(m2001OpenApi);
say('operation counts', {
  ciBaseline: REQUIRED_CI_CONTRACT_BASELINE_REF,
  ciPublic: ciOps.publicOps.length,
  ciInternal: ciOps.internalOps.length,
  m2001Public: m2001Ops.publicOps.length,
  m2001Internal: m2001Ops.internalOps.length,
  headPublic: currentOps.publicOps.length,
  headInternal: currentOps.internalOps.length,
});
say('public ops added since CI baseline', diffLists(ciOps.publicOps, currentOps.publicOps));
say('internal ops added since CI baseline', diffLists(ciOps.internalOps, currentOps.internalOps));
say('public ops added since M2001 source', diffLists(m2001Ops.publicOps, currentOps.publicOps));
say('internal ops added since M2001 source', diffLists(m2001Ops.internalOps, currentOps.internalOps));

const gatewayFragment = readJson('packages/contracts/fragments/p1r-gateway-boundary.openapi.json');
const allowance = gatewayFragment['x-p1r-gateway-boundary'].executionTargetPolicy.compatibilityPromotion;
const sourceSha = stableGovernanceSha256(m2001OpenApi);
const health = currentOpenApi.paths?.['/api/v1/health']?.get;
const serviceConst = currentOpenApi.components?.schemas?.HealthData?.properties?.service?.const;
say('m2001 preconditions', {
  allowanceValid: isValidM2001PromotionAllowance(allowance),
  allowanceKeys: Object.keys(allowance ?? {}).sort(),
  sourceShaMatches: sourceSha === M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  sourceSha,
  pinnedSha: M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  healthOperationId: health?.operationId,
  healthSummary: health?.summary,
  serviceConst,
  previousHasRoot: Boolean(m2001OpenApi['x-p1r-gateway-boundary']),
  currentHasRoot: Boolean(currentOpenApi['x-p1r-gateway-boundary']),
});

function parentOf(document, segments) {
  let node = document;
  for (const segment of segments.slice(0, -1)) {
    node = node?.[segment];
    if (node === undefined || node === null || typeof node !== 'object') return undefined;
  }
  return { parent: node, key: segments.at(-1) };
}

const additiveProbe = [];
for (const entry of M2001_APPROVED_ADDITIVE_NODES) {
  const previous = parentOf(m2001OpenApi, entry.segments);
  const approved = parentOf(currentOpenApi, entry.segments);
  additiveProbe.push({
    segments: entry.segments.join('/'),
    append: entry.append ?? null,
    previousResolves: previous !== undefined,
    approvedResolves: approved !== undefined,
    alreadyOnBaseline: previous ? Object.hasOwn(previous.parent, previous.key) : null,
    presentOnCurrent: approved ? Object.hasOwn(approved.parent, approved.key) : null,
  });
}
say('m2001 additive probe', additiveProbe);

const replacedProbe = [];
for (const entry of M2001_APPROVED_REPLACED_NODES) {
  const previous = parentOf(m2001OpenApi, entry.segments);
  const approved = parentOf(currentOpenApi, entry.segments);
  const previousValue = previous && Object.hasOwn(previous.parent, previous.key) ? previous.parent[previous.key] : undefined;
  const approvedValue = approved && Object.hasOwn(approved.parent, approved.key) ? approved.parent[approved.key] : undefined;
  replacedProbe.push({
    segments: entry.segments.join('/'),
    previousPresent: previousValue !== undefined,
    approvedPresent: approvedValue !== undefined,
    same: JSON.stringify(previousValue) === JSON.stringify(approvedValue),
    previousValue,
    approvedValue,
  });
}
say('m2001 replaced probe', replacedProbe);

const claimsPath = ['x-b8-authentication', 'accessToken', 'authorizationClaims'];
say('authorizationClaims', {
  baseline: parentOf(m2001OpenApi, claimsPath)?.parent?.authorizationClaims,
  current: parentOf(currentOpenApi, claimsPath)?.parent?.authorizationClaims,
});
say('eligibilityClaims keys', {
  baseline: Object.keys(m2001OpenApi['x-b8-authentication']?.accessToken?.eligibilityClaims ?? {}),
  current: Object.keys(currentOpenApi['x-b8-authentication']?.accessToken?.eligibilityClaims ?? {}),
});

const projection = buildM2001OpenApiExpectedProjection(m2001OpenApi, currentOpenApi, allowance);
say('m2001 projection', {
  constructible: projection !== undefined,
  equalsCurrent: projection !== undefined && stableGovernanceSha256(projection) === stableGovernanceSha256(currentOpenApi),
});

function collapsedDiff(left, right, prefix = '', depth = 0, found = []) {
  if (found.length > 180) return found;
  if (JSON.stringify(left) === JSON.stringify(right)) return found;
  const leftObj = left && typeof left === 'object';
  const rightObj = right && typeof right === 'object';
  if (!leftObj || !rightObj || Array.isArray(left) || Array.isArray(right) || depth > 5) {
    found.push(prefix || '$');
    return found;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    if (found.length > 180) break;
    const next = prefix ? `${prefix}.${key}` : key;
    if (!(key in left)) found.push(`+ ${next}`);
    else if (!(key in right)) found.push(`- ${next}`);
    else collapsedDiff(left[key], right[key], next, depth + 1, found);
  }
  return found;
}

if (projection) {
  say('m2001 projection vs current collapsed', collapsedDiff(projection, currentOpenApi).slice(0, 160));
} else {
  say('m2001 current vs baseline collapsed top', collapsedDiff(m2001OpenApi, currentOpenApi).slice(0, 160));
}

const apiReport = validateApiContractData({
  openApi: currentOpenApi,
  schemaRegistry: readJson('packages/contracts/schemas/v1/registry.json'),
});
say('raw api contract error count', apiReport.errors.length);
say('raw api contract idempotency and pagination errors', apiReport.errors.filter((error) => /idempotency|pagination|Cursor|PageSize|signed-access/.test(error)));
say('raw api contract summary', apiReport.summary);

const content = validateContentLifecycle({ root });
say('content lifecycle errors', content.errors);
const inputs = readContentLifecycleInputs({ root });
function findConst(value, location = '$', found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Object.hasOwn(value, 'const')) found.push(`${location}.const=${JSON.stringify(value.const)}`);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'const') continue;
    findConst(child, `${location}.${key}`, found);
  }
  return found;
}
say('b9 const locations', findConst(inputs.b9OpenApi).slice(0, 80));
say('b10 const locations', findConst(inputs.b10OpenApi).slice(0, 80));
const request = inputs.b9OpenApi.components?.schemas?.B9ContentCommandRequest;
say('b9 command enum', request?.properties?.command?.enum);
say('b9 command property keys', Object.keys(request?.properties ?? {}));
say('b9 command oneOf branch summaries', (request?.oneOf ?? []).map((branch, index) => ({
  index,
  keys: Object.keys(branch ?? {}),
  command: branch?.properties?.command,
  required: branch?.required,
  not: branch?.not,
  propertyKeys: Object.keys(branch?.properties ?? {}),
})));

const learning = validateLearningLoopContract({ root });
say('learning loop errors', learning.errors);
const b10 = readJson('packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json');
const policyRoutes = readJson('config/p1r-learning-loop-contract.v1.json').compatibilityPromotion.canonicalRoutes
  .map((route) => `${route.method}:${route.path}`).sort();
const actualRoutes = [];
for (const [route, item] of Object.entries(b10.paths ?? {})) {
  if (!route.startsWith('/api/v1/learning/')) continue;
  for (const [method, operation] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    if (operation?.['x-contract']?.canonical === true) actualRoutes.push(`${method.toUpperCase()}:${route}`);
  }
}
actualRoutes.sort();
say('learning canonical route diff', diffLists(policyRoutes, actualRoutes));

const ownership = validateDataOwnership({ root });
say('data ownership errors', ownership.errors);

const services = [
  'iam-service', 'content-service', 'learning-service', 'assessment-service', 'admin-ops-service',
];
const migrationLists = {};
for (const service of services) {
  const dir = path.join(root, 'services', service, 'src/main/resources/db/migration');
  migrationLists[service] = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
}
say('migration filenames', migrationLists);

const controller = fs.readFileSync(path.join(root, 'services/content-service/src/main/java/com/englishflow/content/web/GradableAssessmentSnapshotController.java'), 'utf8');
const pattern = /(?:`([a-z][a-z0-9_]*(?:_service)|core_api)`|"([a-z][a-z0-9_]*(?:_service)|core_api)"|([a-z][a-z0-9_]*(?:_service)|core_api))\s*\./giu;
const hits = [];
for (const match of controller.matchAll(pattern)) {
  const start = Math.max(0, match.index - 80);
  hits.push(controller.slice(start, match.index + match[0].length + 40).replaceAll('\n', '\\n'));
}
say('assessment schema scanner hits', hits);

const gateway = validateGatewayContract({ root });
say('gateway errors', gateway.errors);
say('gateway summary', gateway.summary);

const iamPolicy = readJson('config/p1r-iam-event-contract.v1.json');
const baselineEvents = JSON.parse(gitShow(M1018_SOURCE_CONTRACT_BASELINE_REF, 'packages/contracts/events/v1/catalog.json'));
const currentEvents = readJson('packages/contracts/events/v1/catalog.json');
say('iam event hashes', {
  baselineSha: stableGovernanceSha256(baselineEvents),
  pinnedSource: M1018_EVENT_SOURCE_SEMANTIC_SHA256,
  sourceMatches: stableGovernanceSha256(baselineEvents) === M1018_EVENT_SOURCE_SEMANTIC_SHA256,
  currentSha: stableGovernanceSha256(currentEvents),
  pinnedExpected: M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
  currentMatchesExpected: stableGovernanceSha256(currentEvents) === M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
  policyValid: validateM1018CompatibilityPolicy(iamPolicy),
});
const eventChanges = compareContracts('events', baselineEvents, currentEvents, { allowance: iamPolicy.compatibilityPromotion });
say('iam event compare current catalog', eventChanges.slice(0, 40));
say('iam event descriptor hash', {
  actual: stableGovernanceSha256(compareM1018EventDescriptors(baselineEvents, currentEvents)),
  pinned: M1018_EVENT_DESCRIPTOR_SET_SHA256,
});

function eventNames(catalog) {
  return (catalog.events ?? []).map((event) => event.eventName).sort();
}
say('event names added since M1018 source', diffLists(eventNames(baselineEvents), eventNames(currentEvents)));

const baselineResult = runGitBaselineCompatibility({
  ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
  governanceRef: '868c2177f62b6d2cf613bed702686dddcfe6943f',
  kind: 'all',
});
say('git baseline compatible', baselineResult.compatible);
say('git baseline promotion', baselineResult.promotion);
say('git baseline breaking', (baselineResult.results ?? []).flatMap((entry) => (entry.breakingChanges ?? []).map((change) => ({
  kind: entry.kind,
  location: change.location,
  reason: change.reason,
}))).slice(0, 80));

fs.writeFileSync('/tmp/grok-mobile-resume-ci-contract-audit-436/diagnose.txt', out.join('\n'));
console.log('wrote diagnose.txt', out.join('\n').length);
