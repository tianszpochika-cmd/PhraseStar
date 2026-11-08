import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  M1018_EVENT_DESCRIPTOR_SET_SHA256,
  M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1018_EVENT_SOURCE_SEMANTIC_SHA256,
  M1018_SOURCE_CONTRACT_BASELINE_REF,
  M2001_APPROVED_ADDITIVE_NODES,
  M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M2001_SOURCE_CONTRACT_BASELINE_REF,
  buildM2001OpenApiExpectedProjection,
  compareM1018EventDescriptors,
  stableGovernanceSha256,
  stableGovernanceValue,
} from '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy/scripts/contracts/compatibility-diff.mjs';
import { validateM1013CompatibilityPolicy } from '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy/scripts/contracts/compatibility-git-baseline.mjs';
import { mergeEvents, projectCanonicalAsyncApi } from '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy/scripts/contracts/merge-b1-fragments.mjs';
import {
  EXPECTED_EVENT_FRAGMENT_INVENTORY,
  M1018_IAM_GAP_D2_CLOSURE_TASKS,
  M1018_SOURCE_D2_CLOSED_EVENT_GAPS,
} from '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy/scripts/contracts/event-catalog-policy.mjs';

const root = '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy';
const out = {};

function gitShow(ref, file) {
  return execFileSync('git', ['show', `${ref}:${file}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
}
function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function names(catalog) {
  return (catalog.events ?? []).map((event) => event.eventName);
}
function delta(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return {
    added: [...b].filter((name) => !a.has(name)),
    removed: [...a].filter((name) => !b.has(name)),
  };
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function resolveParent(document, segments) {
  if (!isRecord(document) || !Array.isArray(segments) || segments.length === 0) return undefined;
  let node = document;
  for (const segment of segments.slice(0, -1)) {
    node = node?.[segment];
    if (!isRecord(node)) return undefined;
  }
  return { parent: node, key: segments[segments.length - 1] };
}

const policy = readJson('config/p1r-learning-loop-contract.v1.json');
const policyErrors = validateM1013CompatibilityPolicy(policy);
const src = fs.readFileSync(path.join(root, 'scripts/contracts/compatibility-git-baseline.mjs'), 'utf8');
const start = src.indexOf('const M1013_CANONICAL_ROUTE_POLICY = Object.freeze(');
const end = src.indexOf('\n]);', start);
const frozenRoutes = eval(src.slice(start + 'const M1013_CANONICAL_ROUTE_POLICY = '.length, end + 3));
const liveRoutes = policy.compatibilityPromotion.canonicalRoutes;
out.m1013 = {
  policyErrors,
  frozenIds: frozenRoutes.map((route) => route.id),
  liveIds: liveRoutes.map((route) => route.id),
  onlyInLive: liveRoutes.filter((route) => !frozenRoutes.some((frozen) => stableGovernanceValue(frozen) === stableGovernanceValue(route))).map((route) => route.id),
  onlyInFrozen: frozenRoutes.filter((route) => !liveRoutes.some((live) => stableGovernanceValue(live) === stableGovernanceValue(route))).map((route) => route.id),
};

const boundary = readJson('packages/contracts/fragments/p1r-gateway-boundary.openapi.json');
const allowance = boundary['x-p1r-gateway-boundary'].executionTargetPolicy.compatibilityPromotion;
const sourceOpenApi = JSON.parse(gitShow(M2001_SOURCE_CONTRACT_BASELINE_REF, 'packages/contracts/openapi/v1/openapi.json'));
const currentOpenApi = readJson('packages/contracts/openapi/v1/openapi.json');
out.m2001 = {
  sourcePin: M2001_SOURCE_CONTRACT_BASELINE_REF,
  sourceSemanticPin: M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  sourceSemanticActual: stableGovernanceSha256(sourceOpenApi),
  sourceSemanticMatches: stableGovernanceSha256(sourceOpenApi) === M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  allowanceValidShape: allowance?.id,
  projectionConstructible: buildM2001OpenApiExpectedProjection(sourceOpenApi, currentOpenApi, allowance) !== undefined,
};
const claimsPath = ['x-b8-authentication', 'accessToken', 'authorizationClaims'];
const sourceClaims = resolveParent(sourceOpenApi, claimsPath);
const currentClaims = resolveParent(currentOpenApi, claimsPath);
out.m2001.authorizationClaims = {
  source: sourceClaims?.parent?.[sourceClaims.key],
  current: currentClaims?.parent?.[currentClaims.key],
};
out.m2001.ensureSchemaOnSource = sourceOpenApi.components?.schemas?.B10EnsurePlanResult !== undefined;
out.m2001.ensureSchemaOnCurrent = currentOpenApi.components?.schemas?.B10EnsurePlanResult !== undefined;
const additiveFailures = [];
const expected = structuredClone(sourceOpenApi);
for (const entry of M2001_APPROVED_ADDITIVE_NODES) {
  if (entry.append !== undefined) continue;
  const target = resolveParent(expected, entry.segments);
  const source = resolveParent(currentOpenApi, entry.segments);
  if (target === undefined || source === undefined || (target.key in target.parent) || !(source.key in source.parent)) {
    additiveFailures.push({
      reason: entry.reason,
      segments: entry.segments,
      targetMissing: target === undefined,
      sourceMissing: source === undefined,
      alreadyOnExpected: target !== undefined && (target.key in target.parent),
      missingOnApproved: source !== undefined && !(source.key in source.parent),
    });
  } else {
    target.parent[target.key] = structuredClone(source.parent[source.key]);
  }
}
const appends = new Map();
for (const entry of M2001_APPROVED_ADDITIVE_NODES) {
  if (entry.append === undefined) continue;
  const key = JSON.stringify(entry.segments);
  if (!appends.has(key)) appends.set(key, { segments: entry.segments, values: [] });
  appends.get(key).values.push(...entry.append);
}
const appendFailures = [];
for (const { segments, values } of appends.values()) {
  const target = resolveParent(expected, segments);
  const source = resolveParent(currentOpenApi, segments);
  const base = target?.parent?.[target.key];
  const current = source?.parent?.[source.key];
  const rebuilt = Array.isArray(base) ? [...base, ...values] : null;
  const equal = Array.isArray(current) && rebuilt && rebuilt.length === current.length && rebuilt.every((value, index) => current[index] === value);
  if (!equal) {
    appendFailures.push({ segments, approvedAppend: values, source: base, current, rebuilt });
  }
}
out.m2001.wholeNodeFailures = additiveFailures;
out.m2001.appendFailures = appendFailures;

function buildCatalog(fragment) {
  const catalog = structuredClone(JSON.parse(gitShow(M1018_SOURCE_CONTRACT_BASELINE_REF, 'packages/contracts/events/v1/catalog.json')));
  catalog['x-p1r-event-governance'].fragmentInventory = structuredClone(EXPECTED_EVENT_FRAGMENT_INVENTORY);
  catalog['x-p1r-event-governance'].plannedClosures = catalog['x-p1r-event-governance'].plannedClosures.map((closure) => {
    const d2ClosureTasks = M1018_IAM_GAP_D2_CLOSURE_TASKS[closure?.gapId];
    return {
      ...closure,
      status: M1018_SOURCE_D2_CLOSED_EVENT_GAPS.includes(closure?.gapId) ? 'D2_CONTRACT_CLOSED' : closure.status,
      ...(d2ClosureTasks === undefined ? {} : { d2ClosureTasks: [...d2ClosureTasks] }),
    };
  });
  mergeEvents(catalog, fragment, 'packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json');
  projectCanonicalAsyncApi(catalog);
  return catalog;
}
const baselineCatalog = JSON.parse(gitShow(M1018_SOURCE_CONTRACT_BASELINE_REF, 'packages/contracts/events/v1/catalog.json'));
const fragment = readJson('packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json');
const built = buildCatalog(fragment);
const currentCatalog = readJson('packages/contracts/events/v1/catalog.json');
const descriptors = compareM1018EventDescriptors(baselineCatalog, built);
out.m1018 = {
  sourcePin: M1018_SOURCE_CONTRACT_BASELINE_REF,
  sourceSemanticPin: M1018_EVENT_SOURCE_SEMANTIC_SHA256,
  sourceSemanticActual: stableGovernanceSha256(baselineCatalog),
  expectedSemanticPin: M1018_EVENT_EXPECTED_SEMANTIC_SHA256,
  builtSemanticActual: stableGovernanceSha256(built),
  descriptorPin: M1018_EVENT_DESCRIPTOR_SET_SHA256,
  descriptorActual: stableGovernanceSha256(descriptors),
  builtVsBaselineNames: delta(names(baselineCatalog), names(built)),
  currentCatalogVsBuiltNames: delta(names(built), names(currentCatalog)),
  currentCatalogVsBaselineNames: delta(names(baselineCatalog), names(currentCatalog)),
  descriptorCount: descriptors.length,
};
const freezeLog = execFileSync('git', ['log', '-S', M1018_EVENT_EXPECTED_SEMANTIC_SHA256, '--format=%H', '--', 'scripts/contracts/compatibility-diff.mjs'], {
  cwd: root, encoding: 'utf8',
}).trim().split('\n').filter(Boolean);
out.m1018.digestIntroducingCommits = freezeLog;
if (freezeLog[0]) {
  const oldFragmentText = gitShow(freezeLog[freezeLog.length - 1], 'packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json');
  const oldBuilt = buildCatalog(JSON.parse(oldFragmentText));
  out.m1018.oldestFreezeFragmentRebuiltWithCurrentGovernance = stableGovernanceSha256(oldBuilt);
  out.m1018.oldestFreezeFragmentMatchesExpected = stableGovernanceSha256(oldBuilt) === M1018_EVENT_EXPECTED_SEMANTIC_SHA256;
  out.m1018.oldestFreezeVsCurrentFragmentNames = delta(names(JSON.parse(oldFragmentText)), names(fragment));
}

fs.writeFileSync('/tmp/grok-mobile-resume-ci-current-463/projection-diag.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  m1013Errors: out.m1013.policyErrors,
  onlyInLive: out.m1013.onlyInLive,
  m2001Match: out.m2001.sourceSemanticMatches,
  constructible: out.m2001.projectionConstructible,
  wholeNodeFailures: out.m2001.wholeNodeFailures.map((item) => item.segments.join('/')),
  appendFail: out.m2001.appendFailures.map((item) => ({ segments: item.segments.join('/'), current: item.current, rebuilt: item.rebuilt })),
  m1018: {
    sourceOk: out.m1018.sourceSemanticActual === out.m1018.sourceSemanticPin,
    built: out.m1018.builtSemanticActual,
    expected: out.m1018.expectedSemanticPin,
    descriptorOk: out.m1018.descriptorActual === out.m1018.descriptorPin,
    builtVsBaselineNames: out.m1018.builtVsBaselineNames,
    currentVsBuilt: out.m1018.currentCatalogVsBuiltNames,
    currentVsBaseline: out.m1018.currentCatalogVsBaselineNames,
    freeze: out.m1018.digestIntroducingCommits,
    oldMatches: out.m1018.oldestFreezeFragmentMatchesExpected,
    fragmentNameDelta: out.m1018.oldestFreezeVsCurrentFragmentNames,
  },
}, null, 2));
