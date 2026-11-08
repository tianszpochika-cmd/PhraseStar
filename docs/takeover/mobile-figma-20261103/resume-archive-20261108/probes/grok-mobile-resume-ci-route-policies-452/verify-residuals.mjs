import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/Admin/.codex/worktrees/mobile-resume-ci-20261107/cloudstudy';
const sourceRef = '66246d5b4a68a988a9af4ece68a446640b123812';
const HTTP = new Set(['get', 'put', 'post', 'patch', 'delete', 'head', 'options']);
const REVIEWED_PUBLIC = [
  'listAdminLearnerSubjects', 'getAdminLearnerAssessments', 'getAdminLearnerPlans', 'getAdminLearnerProfile', 'getAdminLearnerSrs',
  'listAdminRiskCases', 'listUnfinishedSagas', 'readWorkflowSaga', 'listAssessmentMistakes', 'resolveB9LearnerContentSubstitute',
  'listB8LockedAccounts', 'readMediaAssetTasks', 'readPrivacyExportStatus', 'readPrivacyExportDownload', 'getLearningReportShare',
  'importB9ContentBatch', 'validateB9ContentAuto', 'sendAdminLearnerCommand', 'sendAdminLearningCommand', 'fileAdminRiskCase',
  'decideAdminRiskCase', 'evaluateAdminRiskRules', 'requestWorkflowRecovery', 'approveWorkflowRecovery', 'executeWorkflowRecovery',
  'rejectWorkflowRecovery', 'compensateWorkflowSaga', 'issueAssessmentVariant', 'verifyAssessmentMistake', 'retestB10PlacementSession',
  'ensureB10LearningPlan', 'replanB10LearningPlan', 'revokeLearningReportShare', 'issueLearningReportShare', 'registerMediaAsset',
  'retryMediaAsset', 'upsertMediaSubtitle', 'mintMediaUploadUrl', 'activateMediaAsset',
];
const REVIEWED_INTERNAL = [
  'getIamLearningConsentFact',
  'matchB10AssessmentAttemptBinding',
  'bindB9PublishedReading',
  'scoreB10AssessmentContentSnapshot',
];

function operations(openApi, prefix) {
  const result = [];
  for (const [route, pathItem] of Object.entries(openApi.paths ?? {})) {
    if (!route.startsWith(`${prefix}/`)) continue;
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP.has(method) || !operation || typeof operation !== 'object' || Array.isArray(operation)) continue;
      result.push({ route, method: method.toUpperCase(), operation });
    }
  }
  return result;
}

function keyOf(item) {
  return `${item.method} ${item.route} ${item.operation.operationId ?? ''}`;
}

function idOf(item) {
  return item.operation.operationId ?? '';
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableIdDigest(ids) {
  const body = `[${[...ids].sort().map((id) => JSON.stringify(id)).join(',')}]`;
  return sha(body);
}

function routeMatches(rule, route, method) {
  const match = rule?.match;
  if (!match || !Array.isArray(match.methods) || !match.methods.includes(method)) return false;
  if (match.type === 'EXACT') return route === match.path;
  if (match.type === 'PREFIX') return route === match.path || route.startsWith(`${match.path}/`);
  return false;
}

function highestRules(rules, route, method) {
  const matches = rules.filter((rule) => routeMatches(rule, route, method));
  if (matches.length === 0) return [];
  const priority = Math.max(...matches.map((rule) => rule.priority));
  return matches.filter((rule) => rule.priority === priority);
}

const current = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/openapi/v1/openapi.json'), 'utf8'));
const sourceText = execFileSync('git', ['show', `${sourceRef}:packages/contracts/openapi/v1/openapi.json`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const source = JSON.parse(sourceText);
const fragment = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json'), 'utf8'));
const rules = fragment['x-p1r-gateway-boundary'].routeRules;

function diffSet(prefix) {
  const currentOps = operations(current, prefix);
  const sourceOps = operations(source, prefix);
  const currentIds = new Set(currentOps.map(idOf));
  const sourceIds = new Set(sourceOps.map(idOf));
  const added = [...currentIds].filter((id) => !sourceIds.has(id)).sort();
  const removed = [...sourceIds].filter((id) => !currentIds.has(id)).sort();
  return { currentOps, sourceOps, added, removed };
}

function describe(ops, id) {
  return ops.filter((item) => idOf(item) === id).map((item) => {
    const top = highestRules(rules, item.route, item.method);
    return {
      operationId: id,
      method: item.method,
      route: item.route,
      owner: item.operation['x-owner'] ?? null,
      permission: item.operation['x-permission'] ?? item.operation['x-authorization']?.requiredPermission ?? null,
      ruleId: top.map((rule) => rule.ruleId),
      ruleOwner: top.map((rule) => rule.upstreamOwner),
      ownerMatchesRule: top.length === 1 && top[0].upstreamOwner === item.operation['x-owner'],
    };
  });
}

const publicDiff = diffSet('/api/v1');
const internalDiff = diffSet('/internal/v1');
const reviewedPublic = new Set(REVIEWED_PUBLIC);
const reviewedInternal = new Set(REVIEWED_INTERNAL);
const publicRemainder = publicDiff.currentOps.map(idOf).filter((id) => !reviewedPublic.has(id));
const internalRemainder = internalDiff.currentOps.map(idOf).filter((id) => !reviewedInternal.has(id));
const sourcePublicIds = publicDiff.sourceOps.map(idOf);
const sourceInternalIds = internalDiff.sourceOps.map(idOf);

const report = {
  reviewedPublicCount: REVIEWED_PUBLIC.length,
  reviewedPublicUnique: reviewedPublic.size,
  reviewedInternalCount: REVIEWED_INTERNAL.length,
  publicCurrent: publicDiff.currentOps.length,
  publicSource: publicDiff.sourceOps.length,
  publicAdded: publicDiff.added,
  publicRemoved: publicDiff.removed,
  publicAddedEqualsReviewed: publicDiff.added.length === REVIEWED_PUBLIC.length
    && publicDiff.added.every((id) => reviewedPublic.has(id))
    && REVIEWED_PUBLIC.every((id) => publicDiff.added.includes(id)),
  publicRemainderCount: publicRemainder.length,
  publicRemainderEqualsSource: stableIdDigest(publicRemainder) === stableIdDigest(sourcePublicIds)
    && publicRemainder.length === sourcePublicIds.length,
  publicDuplicateCurrentIds: publicDiff.currentOps.map(idOf).length !== new Set(publicDiff.currentOps.map(idOf)).size,
  publicBaselineDigest: stableIdDigest(publicRemainder),
  sourcePublicDigest: stableIdDigest(sourcePublicIds),
  internalCurrent: internalDiff.currentOps.length,
  internalSource: internalDiff.sourceOps.length,
  internalAdded: internalDiff.added,
  internalRemoved: internalDiff.removed,
  internalRemainderCount: internalRemainder.length,
  internalReviewedPresent: REVIEWED_INTERNAL.every((id) => internalDiff.currentOps.some((item) => idOf(item) === id)),
  internalRemainderDigest: stableIdDigest(internalRemainder),
  sourceInternalDigest: stableIdDigest(sourceInternalIds),
  internalDuplicateCurrentIds: internalDiff.currentOps.map(idOf).length !== new Set(internalDiff.currentOps.map(idOf)).size,
  publicMappings: REVIEWED_PUBLIC.flatMap((id) => describe(publicDiff.currentOps, id)),
  internalMappings: REVIEWED_INTERNAL.flatMap((id) => describe(internalDiff.currentOps, id)),
  baselineOperationCount: fragment['x-p1r-gateway-boundary'].internalOperationPolicy.baselineOperationCount,
  canonicalBaseline: current['x-p1r-gateway-boundary']?.internalOperationPolicy?.baselineOperationCount,
};

const b10 = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config/p1r-learning-loop-contract.v1.json'), 'utf8'));
const canonicalLearning = [];
for (const [route, pathItem] of Object.entries(b10.paths ?? {})) {
  if (!route.startsWith('/api/v1/learning/')) continue;
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!HTTP.has(method) || operation?.['x-contract']?.canonical !== true) continue;
    canonicalLearning.push(`${method.toUpperCase()}:${route}`);
  }
}
canonicalLearning.sort();
const policyRoutes = policy.compatibilityPromotion.canonicalRoutes.map((route) => `${route.method}:${route.path}`).sort();
report.canonicalLearning = canonicalLearning;
report.policyRoutes = policyRoutes;
report.canonicalMinusPolicy = canonicalLearning.filter((key) => !policyRoutes.includes(key));
report.policyMinusCanonical = policyRoutes.filter((key) => !canonicalLearning.includes(key));

const out = '/tmp/grok-mobile-resume-ci-route-policies-452/verify-residuals.json';
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  publicCurrent: report.publicCurrent,
  publicSource: report.publicSource,
  publicAdded: report.publicAdded.length,
  publicRemoved: report.publicRemoved.length,
  publicAddedEqualsReviewed: report.publicAddedEqualsReviewed,
  publicRemainderCount: report.publicRemainderCount,
  publicRemainderEqualsSource: report.publicRemainderEqualsSource,
  publicBaselineDigest: report.publicBaselineDigest,
  internalCurrent: report.internalCurrent,
  internalSource: report.internalSource,
  internalAdded: report.internalAdded,
  internalRemoved: report.internalRemoved,
  internalRemainderCount: report.internalRemainderCount,
  internalReviewedPresent: report.internalReviewedPresent,
  internalRemainderDigest: report.internalRemainderDigest,
  baselineOperationCount: report.baselineOperationCount,
  canonicalMinusPolicy: report.canonicalMinusPolicy,
  policyMinusCanonical: report.policyMinusCanonical,
  publicMappingProblems: report.publicMappings.filter((item) => !item.ownerMatchesRule || item.ruleId.length !== 1),
  internalMappings: report.internalMappings,
}, null, 2));
