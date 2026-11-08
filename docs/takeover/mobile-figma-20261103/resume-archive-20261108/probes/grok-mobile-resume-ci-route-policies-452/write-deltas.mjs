import fs from 'node:fs';

const out = '/tmp/grok-mobile-resume-ci-route-policies-452';
const root = '/Users/Admin/.codex/worktrees/mobile-resume-ci-20261107/cloudstudy';
const verify = JSON.parse(fs.readFileSync(`${out}/verify-residuals.json`, 'utf8'));
const openapi = JSON.parse(fs.readFileSync(`${root}/packages/contracts/openapi/v1/openapi.json`, 'utf8'));
const fragment = JSON.parse(fs.readFileSync(`${root}/packages/contracts/fragments/p1r-gateway-boundary.openapi.json`, 'utf8'));
const rules = fragment['x-p1r-gateway-boundary'].routeRules;
const HTTP = new Set(['get', 'put', 'post', 'patch', 'delete', 'head', 'options']);

function find(id) {
  for (const [route, item] of Object.entries(openapi.paths)) {
    for (const [method, op] of Object.entries(item ?? {})) {
      if (!HTTP.has(method) || !op || typeof op !== 'object' || Array.isArray(op)) continue;
      if (op.operationId === id) return { route, method: method.toUpperCase(), op };
    }
  }
  return null;
}

function match(rule, route, method) {
  const entry = rule.match;
  if (!entry?.methods?.includes(method)) return false;
  if (entry.type === 'EXACT') return route === entry.path;
  if (entry.type === 'PREFIX') return route === entry.path || route.startsWith(`${entry.path}/`);
  return false;
}

function top(route, method) {
  const hits = rules.filter((rule) => match(rule, route, method));
  if (!hits.length) return [];
  const priority = Math.max(...hits.map((rule) => rule.priority));
  return hits.filter((rule) => rule.priority === priority);
}

function row(id, scope) {
  const found = find(id);
  const owners = top(found.route, found.method);
  const explicit = found.op['x-owner'] ?? found.op['x-contract']?.owner ?? null;
  return {
    operationId: id,
    method: found.method,
    path: found.route,
    explicitOwner: explicit,
    permission: found.op['x-permission'] ?? found.op['x-authorization']?.requiredPermission ?? null,
    routeRuleId: owners[0]?.ruleId ?? null,
    routeRuleOwner: owners[0]?.upstreamOwner ?? null,
    routeRuleCount: owners.length,
    explicitOwnerMatchesRule: explicit != null && owners.length === 1 && owners[0].upstreamOwner === explicit,
    scope,
  };
}

const publicRows = verify.publicAdded.map((id) => row(id, 'public-added'));
const internalFour = [
  'getIamLearningConsentFact',
  'matchB10AssessmentAttemptBinding',
  'bindB9PublishedReading',
  'scoreB10AssessmentContentSnapshot',
];
const internalAlreadyIn66 = verify.internalAdded.filter((id) => !internalFour.includes(id));
const delta = {
  sourceRef: '66246d5b4a68a988a9af4ece68a446640b123812',
  public: {
    sourceCount: verify.publicSource,
    headCount: verify.publicCurrent,
    added: publicRows,
    removed: verify.publicRemoved,
    remainderCount: verify.publicRemainderCount,
    remainderEqualsSourceOperationIds: verify.publicRemainderEqualsSource,
    remainderDigest: verify.publicBaselineDigest,
    sourceDigest: verify.sourcePublicDigest,
    explicitOwnerGaps: publicRows.filter((item) => item.explicitOwner == null).map((item) => ({
      operationId: item.operationId,
      path: item.path,
      routeRuleId: item.routeRuleId,
      routeRuleOwner: item.routeRuleOwner,
    })),
    conflictingOwners: publicRows.filter((item) => item.explicitOwner != null && !item.explicitOwnerMatchesRule),
    uncovered: publicRows.filter((item) => item.routeRuleCount !== 1),
  },
  internal: {
    sourceCount: verify.internalSource,
    headCount: verify.internalCurrent,
    addedSinceSource: verify.internalAdded,
    removed: verify.internalRemoved,
    alreadyInsideFrozen66: internalAlreadyIn66.map((id) => row(id, 'internal-already-in-66')),
    reviewedResidual: internalFour.map((id) => row(id, 'internal-reviewed-residual')),
    headMinusReviewedCount: verify.internalRemainderCount,
    remainderDigest: verify.internalRemainderDigest,
    policyBaselineOperationCount: verify.baselineOperationCount,
  },
};
fs.writeFileSync(`${out}/reviewed-deltas.json`, `${JSON.stringify(delta, null, 2)}\n`);
console.log(JSON.stringify({
  publicAdded: delta.public.added.length,
  publicRemoved: delta.public.removed.length,
  gaps: delta.public.explicitOwnerGaps,
  conflicts: delta.public.conflictingOwners.length,
  uncovered: delta.public.uncovered.length,
  internalReviewed: delta.internal.reviewedResidual,
  alreadyInside66: delta.internal.alreadyInsideFrozen66.map((item) => item.operationId),
}, null, 2));
